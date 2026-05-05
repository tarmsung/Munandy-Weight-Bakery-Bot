const { getSession, setSession, clearSession } = require('../sessions/sessionManager');
const { getSupervisorBranch } = require('../db/supervisors');

const QUESTIONS = [
    { step: 'AWAITING_DATE',           key: 'date',           text: "Please enter the Date of this report (e.g., Today, or DD/MM/YYYY)." },
    { step: 'AWAITING_SHOP',           key: 'shop',           text: "Please provide your commentary on the *Shop*." },
    { step: 'AWAITING_DELIVERY',       key: 'delivery',       text: "Please provide your commentary on *Delivery*." },
    { step: 'AWAITING_PROCUREMENT',    key: 'procurement',    text: "Please provide your commentary on *Procurement*." },
    { step: 'AWAITING_PRODUCTION',     key: 'production',     text: "Please provide your commentary on *Production*." },
    { step: 'AWAITING_WORKERS',        key: 'workers',        text: "Please provide your commentary on *Workers*." },
    { step: 'AWAITING_CASHING_OFFICE', key: 'cashing_office', text: "Please provide your commentary on the *Cashing Office*." },
    { step: 'AWAITING_SECURITY',       key: 'security',       text: "Please provide your commentary on *Security*." },
    { step: 'AWAITING_PACKING',        key: 'packing',        text: "Please provide your commentary on *Packing*." },
    { step: 'AWAITING_HYGIENE',        key: 'hygiene',        text: "Please provide your commentary on *Hygiene*." }
];

async function startSupervisorReport(sock, jid, senderNumber) {
    const branch = await getSupervisorBranch(senderNumber);
    if (!branch) {
        await sock.sendMessage(jid, { text: "❌ You are not authorized to submit Supervisor Reports." });
        return;
    }

    setSession(jid, { 
        flowType: 'super', 
        step: QUESTIONS[0].step,
        questionIndex: 0,
        senderNumber: senderNumber,
        branch: branch,
        responses: {} 
    });

    await sock.sendMessage(jid, { 
        text: `📋 *Supervisor Report System*\nWelcome. Type *cancel* at any time to exit.\n\n${QUESTIONS[0].text}` 
    });
}

async function handleSupervisorReportStep(sock, msg, text, jid) {
    const session = getSession(jid);
    if (!session || session.flowType !== 'super') return false;

    const input = text.trim();
    if (input.toLowerCase() === 'cancel') {
        clearSession(jid);
        await sock.sendMessage(jid, { text: "❌ Supervisor report cancelled." });
        return true;
    }

    const currentIndex = session.questionIndex;
    const currentQ = QUESTIONS[currentIndex];

    // Save the response for the current question
    session.responses[currentQ.key] = input;

    // Check if there is a next question
    const nextIndex = currentIndex + 1;
    if (nextIndex < QUESTIONS.length) {
        const nextQ = QUESTIONS[nextIndex];
        setSession(jid, {
            ...session,
            questionIndex: nextIndex,
            step: nextQ.step
        });
        await sock.sendMessage(jid, { text: nextQ.text });
    } else {
        // We have collected all responses. Build and send the report.
        await finalizeReport(sock, jid, session);
    }
    return true;
}

async function finalizeReport(sock, jid, session) {
    const { responses, senderNumber, branch } = session;

    let reportText = `📋 *SUPERVISOR DAILY REPORT* 📋\n`;
    reportText += `*Date:* ${responses.date}\n`;
    reportText += `*Supervisor Number:* ${senderNumber}\n`;
    reportText += `*Branch:* ${branch}\n\n`;

    reportText += `🏪 *Shop:*\n${responses.shop}\n\n`;
    reportText += `🚚 *Delivery:*\n${responses.delivery}\n\n`;
    reportText += `🛒 *Procurement:*\n${responses.procurement}\n\n`;
    reportText += `🏭 *Production:*\n${responses.production}\n\n`;
    reportText += `👷 *Workers:*\n${responses.workers}\n\n`;
    reportText += `💰 *Cashing Office:*\n${responses.cashing_office}\n\n`;
    reportText += `🔐 *Security:*\n${responses.security}\n\n`;
    reportText += `📦 *Packing:*\n${responses.packing}\n\n`;
    reportText += `🧹 *Hygiene:*\n${responses.hygiene}\n`;

    try {
        const groupId = process.env.SUPERVISOR_REPORT_GROUP_ID || process.env.FLEET_REPORT_GROUP_ID;
        if (!groupId) {
            console.error("No supervisor report group ID found in .env");
            await sock.sendMessage(jid, { text: "⚠️ Error: Supervisor group JID not configured. Sending report here instead." });
            await sock.sendMessage(jid, { text: reportText });
        } else {
            await sock.sendMessage(groupId, { text: reportText });
            await sock.sendMessage(jid, { text: "✅ Your report has been successfully submitted to the Supervisor Group!" });
        }
    } catch (err) {
        console.error("Failed to send supervisor report:", err);
        await sock.sendMessage(jid, { text: "❌ Failed to submit the report. Please contact an admin." });
    }

    clearSession(jid);
}

module.exports = { startSupervisorReport, handleSupervisorReportStep };
