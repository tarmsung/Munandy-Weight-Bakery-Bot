const { hasSession, clearSession, getSession, setSession } = require('../sessions/sessionManager');
console.log('[DEBUG] messageHandler.js loaded');

const { startWeigh, handleWeighStep } = require('./weighHandler');
const { handleToday } = require('./todayHandler');
const { startAdminMenu, handleAdminStep } = require('./adminHandler');
const { startDelete, handleDeleteStep } = require('./deleteHandler');
const { startVan, handleVanStep } = require('../vehicle/vanHandler');
const { handleRouteMessage } = require('../vehicle/routeFlow');
const { handleEditMessage } = require('../vehicle/editFlow');
const { getAllSupervisors } = require('../db/supervisors');
const { parseExpenseMessage } = require('../vehicle/expenseParser');
const { saveVehicleExpense } = require('../db/expenses');
const { sendEndOfDayReport, runDailyFleetReport, runMonthlyViabilityReport } = require('../scheduler');

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
    
    // Attempt to extract from sender or fallback to altJid
    const extractPhoneNumber = (jid) => jid.split('@')[0].split(':')[0];
    let senderNumber = extractPhoneNumber(sender);
    
    if (sender.includes('@lid')) {
        // If we only have LID but there's an altJid (which contains the real number), use it
        if (altJid) {
            senderNumber = extractPhoneNumber(altJid);
        }
    }

    console.log(`[MSG] JID: ${jid} | Sender: ${senderNumber} | Text: ${text}`);

    // ── Authorization Check ────────────────────────────────────────────────────
    // Only allow ADMIN NUMBERS, ADMIN LIDS, or registered SUPERVISORS to talk to the bot
    const adminNumsStr = process.env.ADMIN_NUMBERS || '';
    const adminNums = adminNumsStr.split(',').map(n => n.trim());
    
    const adminLidsStr = process.env.ADMIN_LIDS || '';
    const adminLids = adminLidsStr.split(',').map(n => n.trim());

    // Check against standard numbers OR explicitly known LIDs
    let isAuthorized = adminNums.includes(senderNumber) || adminLids.includes(senderNumber);

    if (!isAuthorized) {
        try {
            const supervisors = await getAllSupervisors();
            isAuthorized = supervisors.some((s) => s.phone_number === senderNumber);
        } catch (err) {
            console.error('Failed to fetch supervisors for auth check:', err.message);
        }
    }

    const expenseGroupJid = process.env.EXPENSE_GROUP_JID;
    if (expenseGroupJid && jid === expenseGroupJid) {
        // Members of the authorized expense group can post expenses
        isAuthorized = true;
    }

    const cmdRaw = text.toLowerCase();
    const isPublicCmd = ['van', '/van', '!van', 'route', '/route', '!route', 'edit', '/edit', '!edit'].includes(cmdRaw);
    
    let inAllowedSession = false;
    if (hasSession(jid)) {
        const sess = getSession(jid);
        if (sess.flowType === 'van' || sess.flowType === 'route' || sess.flow === 'route' || sess.flow === 'van' || sess.flowType === 'edit' || sess.flow === 'edit') inAllowedSession = true;
    }
    
    const restrictedCmds = ['weigh', '/weigh', '!weigh', 'today', '/today', '!today', 'ping', '!ping', 'admin', 'delete', '/delete', '!delete'];
    const isRestrictedCmd = restrictedCmds.includes(cmdRaw);

    if (!isAuthorized) {
        if (isRestrictedCmd) {
            // Only reply with the "rejection" if they specifically try a restricted command
            if (!jid.endsWith('@g.us')) {
                await sock.sendMessage(jid, { text: `🚫 You are not authorised to use this ChatBot.` });
                console.log(`[AUTH FAILED] Replied to restricted command from: ${senderNumber}`);
            }
            return;
        }
        
        if (!isPublicCmd && !inAllowedSession) {
            // SILENT REJECTION for unknown input or greetings (making the bot appear dead to strangers)
            console.log(`[AUTH SILENT] Ignored unknown message from unauthorized user: ${senderNumber}`);
            return;
        }
    }

    const cmd = text.toLowerCase();

    // ── Expense Interception ───────────────────────────────────────────────────
    if (expenseGroupJid && jid === expenseGroupJid) {
        const isExpenseTrigger = cmdRaw.startsWith('expense');
        const isCommand = ['!ping', 'ping', 'cancel', '!expenses'].includes(cmdRaw);

        // We only process if it starts with "Expense" or is a specific bot command
        if (isExpenseTrigger) {
            const parserResult = parseExpenseMessage(text);
            
            if (parserResult.success && parserResult.data) {
                const data = parserResult.data;
                try {
                    await saveVehicleExpense({
                        vehicle_registration: data.vehicle_registration,
                        amount: data.amount,
                        description: data.description,
                        source_message: text,
                        reporter_jid: sender
                    });
                    await sock.sendMessage(jid, { 
                        text: `✅ Logged expense for *${data.vehicle_registration}* ($${data.amount.toFixed(2)})\nDescription: ${data.description}`
                    }, { quoted: msg });
                } catch (e) {
                    await sock.sendMessage(jid, { text: `❌ Failed to save expense to database.` }, { quoted: msg });
                }
            } else {
                // If the parse fails, send back the specific descriptive error
                await sock.sendMessage(jid, { text: parserResult.error }, { quoted: msg });
            }
            return; // consumed
        }
        
        // If it's not a command either, we ignore the message (general chatter)
        if (!isCommand) {
            console.log(`[EXPENSE GROUP] Ignored non-expense message: ${text.substring(0, 20)}...`);
            return;
        }
    }

    // ── Global Command Override (Break out of sessions) ────────────────────────
    if (['cancel', 'weigh', '/weigh', '!weigh', 'today', '/today', '!today', 'ping', '!ping', 'admin', 'delete', '/delete', '!delete', 'van', '/van', '!van', 'route', '/route', '!route', 'edit', '/edit', '!edit'].includes(cmd)) {
        if (hasSession(jid)) {
            clearSession(jid);
            if (cmd === 'cancel') {
                await sock.sendMessage(jid, { text: '❌ Session ended.' });
                return;
            }
        } else if (cmd === 'cancel') {
            return; // Ignore "cancel" if no session exists to avoid noise
        }
    } else {
        // ── Active session: route non-command input to the active state machine
        if (hasSession(jid)) {
            const session = getSession(jid);
            console.log(`[DEBUG] Session found for ${jid}: flowType=${session.flowType}, step=${session.step}, flow=${session.flow}`);
            
            if (session.flowType === 'van') {
                console.log(`[DEBUG] Routing to handleVanStep`);
                await handleVanStep(sock, msg, text, jid);
                return;
            } else if (session.flowType === 'route' || session.flow === 'route') {
                console.log(`[DEBUG] Routing to handleRouteMessage`);
                await handleRouteMessage(sock, jid, text, session);
                return;
            } else if (session.flowType === 'edit' || session.flow === 'edit') {
                console.log(`[DEBUG] Routing to handleEditMessage`);
                await handleEditMessage(sock, jid, text, session);
                return;
            }

            console.log(`[DEBUG] Testing weigh flow`);
            let handled = await handleWeighStep(sock, msg, text, jid);
            console.log(`[DEBUG] handleWeighStep returned: ${handled}`);

            if (!handled) {
                console.log(`[DEBUG] Testing delete flow`);
                handled = await handleDeleteStep(sock, msg, text, jid);
                console.log(`[DEBUG] handleDeleteStep returned: ${handled}`);
            }
            if (!handled) {
                console.log(`[DEBUG] Testing admin flow`);
                handled = await handleAdminStep(sock, msg, text, jid);
                console.log(`[DEBUG] handleAdminStep returned: ${handled}`);
            }
            if (handled) return;
        }

    }

    // ── Commands ───────────────────────────────────────────────────────────────
    // ── Admin Command ──────────────────────────────────────────────────────────
    if (adminNums.includes(senderNumber)) {
        if (cmd === 'admin') {
            await startAdminMenu(sock, jid, senderNumber);
            return;
        }

        if (cmd === '!testreport') {
            await sock.sendMessage(jid, { text: `⏳ Generating manual weight report with AI analysis... Please wait a few seconds.` });
            await sendEndOfDayReport();
            return;
        }

        if (cmd === '!testfleet') {
            await sock.sendMessage(jid, { text: `⏳ Generating manual fleet report... Please wait a few seconds.` });
            try {
                await runDailyFleetReport(true);
                await sock.sendMessage(jid, { text: `✅ Fleet report triggered. Check the Munandy Transport group.` });
            } catch (err) {
                console.error('[!testfleet] Error:', err);
                await sock.sendMessage(jid, { text: `❌ Failed to generate fleet report: ${err.message}` });
            }
            return;
        }

        if (cmd === '!testviability') {
            await sock.sendMessage(jid, { text: `⏳ Generating monthly vehicle viability report... Please wait a few seconds.` });
            try {
                await runMonthlyViabilityReport();
                await sock.sendMessage(jid, { text: `✅ Viability report triggered.` });
            } catch (err) {
                console.error('[!testviability] Error:', err);
                await sock.sendMessage(jid, { text: `❌ Failed to generate viability report: ${err.message}` });
            }
            return;
        }

        if (cmd === '!getjid') {
            await sock.sendMessage(jid, { text: `📍 The JID for this chat is: *${jid}*` }, { quoted: msg });
            return;
        }

        if (cmd === '!expenses') {
            const { getRecentExpenses } = require('../db/expenses');
            try {
                const recent = await getRecentExpenses(10);
                if (recent.length === 0) {
                    await sock.sendMessage(jid, { text: "No expenses recorded recently." });
                } else {
                    let list = "*Last 10 Vehicle Expenses:*\n\n";
                    recent.forEach(exp => {
                        const date = new Date(exp.expense_date).toLocaleDateString();
                        list += `• [${date}] *${exp.vehicle_registration}*: $${exp.amount} (${exp.description})\n`;
                    });
                    await sock.sendMessage(jid, { text: list });
                }
            } catch (err) {
                await sock.sendMessage(jid, { text: "❌ Failed to fetch expenses." });
            }
            return;
        }
    }

    if (['weigh', '/weigh', '!weigh'].includes(cmd)) {
        await startWeigh(sock, jid, senderNumber);
        return;
    }

    if (['delete', '/delete', '!delete'].includes(cmd)) {
        await startDelete(sock, jid, senderNumber);
        return;
    }

    if (['van', '/van', '!van'].includes(cmd)) {
        await startVan(sock, jid);
        return;
    }

    if (['route', '/route', '!route'].includes(cmd)) {
        setSession(jid, { flowType: 'route', step: 'ROUTE_AWAIT_DRIVER_ID' });
        await sock.sendMessage(jid, { text: 'Enter your driver ID' });
        return;
    }

    if (['edit', '/edit', '!edit'].includes(cmd)) {
        setSession(jid, { flowType: 'edit', step: 'EDIT_SELECT_TYPE' });
        await sock.sendMessage(jid, { text: "Which type of report would you like to edit?\n1. Van Inspection\n2. Route Report\n\nReply with the number or *cancel*." });
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
}

module.exports = { handleMessage };
