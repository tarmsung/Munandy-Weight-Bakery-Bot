const { hasSession } = require('../sessions/sessionManager');
const { startWeigh, handleWeighStep } = require('./weighHandler');
const { handleToday } = require('./todayHandler');

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

    const senderNumber = sender.replace(/@s\.whatsapp\.net|@g\.us/, '');
    console.log(`[MSG] ${senderNumber}: ${text}`);

    // ── Active session: route all input through the weigh state machine ────────
    if (hasSession(jid)) {
        const handled = await handleWeighStep(sock, msg, text, jid);
        if (handled) return;
    }

    // ── Commands ───────────────────────────────────────────────────────────────
    const cmd = text.toLowerCase();

    if (cmd === '/weigh' || cmd === '!weigh') {
        await startWeigh(sock, jid, senderNumber);
        return;
    }

    if (cmd === '/today' || cmd === '!today') {
        await handleToday(sock, jid, msg);
        return;
    }

    if (cmd === '!ping') {
        await sock.sendMessage(jid, { text: '🏓 Pong!' }, { quoted: msg });
        return;
    }

    if (cmd === '!help' || cmd === '/help') {
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
