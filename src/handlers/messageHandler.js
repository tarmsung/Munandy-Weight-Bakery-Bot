const { hasSession } = require('../sessions/sessionManager');
const { startWeigh, handleWeighStep } = require('./weighHandler');
const { handleToday } = require('./todayHandler');
const { startAdminMenu, handleAdminStep } = require('./adminHandler');
const { getAllSupervisors } = require('../db/supervisors');
const { sendEndOfDayReport } = require('../scheduler');

function getMessageText(msg) {
    return (
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        ''
    );
}

async function handleMessage(sock, msg) {
    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const text = getMessageText(msg).trim();
    const isFromMe = msg.key.fromMe;

    if (isFromMe || !text) return;

    // When WhatsApp uses LID addressing, remoteJidAlt holds the real phone number
    const altJid = msg.key.remoteJidAlt;
    const senderNumber = altJid
        ? altJid.replace(/@s\.whatsapp\.net|@g\.us|@lid/, '')
        : sender.replace(/@s\.whatsapp\.net|@g\.us|@lid/, '');
    console.log(`[MSG] Raw Sender: ${sender} | Processed: ${senderNumber} | Text: ${text}`);

    // ── Authorization Check ────────────────────────────────────────────────────
    // Only allow ADMIN NUMBERS or registered SUPERVISORS to talk to the bot
    const adminNumsStr = process.env.ADMIN_NUMBERS || '';
    const adminNums = adminNumsStr.split(',').map(n => n.trim());
    let isAuthorized = adminNums.includes(senderNumber);

    if (!isAuthorized) {
        try {
            const supervisors = await getAllSupervisors();
            isAuthorized = supervisors.some((s) => s.phone_number === senderNumber);
        } catch (err) {
            console.error('Failed to fetch supervisors for auth check:', err.message);
        }
    }

    if (!isAuthorized) {
        // Send a rejection message to strangers
        await sock.sendMessage(jid, { text: `🚫 You are not authorised to use this ChatBot.` });
        console.log(`[AUTH FAILED] Replied to unauthorized number: ${senderNumber}`);
        console.log('[DEBUG RAW MSG]', JSON.stringify(msg, null, 2));
        return;
    }

    const cmd = text.toLowerCase();

    // ── Global Command Override (Break out of sessions) ────────────────────────
    if (['weigh', '/weigh', '!weigh', 'today', '/today', '!today', 'ping', '!ping', 'help', '!help', '/help', 'hi', 'hello', 'admin', 'menu'].includes(cmd)) {
        if (hasSession(jid)) clearSession(jid); // Force exit current session if typing a command
    } else {
        // ── Active session: route non-command input to the active state machine
        if (hasSession(jid)) {
            let handled = await handleWeighStep(sock, msg, text, jid);
            if (!handled) {
                handled = await handleAdminStep(sock, msg, text, jid);
            }
            if (handled) return;
        }
    }

    // ── Commands ───────────────────────────────────────────────────────────────
    // ── Admin Command ──────────────────────────────────────────────────────────
    if (adminNums.includes(senderNumber)) {
        if (['hi', 'hello', 'admin', 'menu'].includes(cmd)) {
            await startAdminMenu(sock, jid, senderNumber);
            return;
        }

        if (cmd === '!testreport') {
            await sock.sendMessage(jid, { text: `⏳ Generating manual report with AI analysis... Please wait a few seconds.` });
            await sendEndOfDayReport();
            return;
        }
    }

    if (['weigh', '/weigh', '!weigh'].includes(cmd)) {
        await startWeigh(sock, jid, senderNumber);
        return;
    }

    if (['today', '/today', '!today'].includes(cmd)) {
        await handleToday(sock, jid, msg);
        return;
    }

    if (['ping', '!ping'].includes(cmd)) {
        await sock.sendMessage(jid, { text: '🏓 Pong!' }, { quoted: msg });
        return;
    }

    if (['help', '!help', '/help'].includes(cmd)) {
        await sock.sendMessage(
            jid,
            {
                text:
                    '*🤖 Munandy Weight Bot Commands:*\n\n' +
                    '*/weigh* — Start a new weighing session\n' +
                    '*/today* — View today\'s production summary\n' +
                    '*!ping*  — Check if bot is alive\n' +
                    '*!help*  — Show this help message',
            },
            { quoted: msg }
        );
    }
}

module.exports = { handleMessage };
