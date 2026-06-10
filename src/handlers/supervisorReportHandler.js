const { getSession, setSession, clearSession } = require('../sessions/sessionManager');
const { getSupervisorBranch } = require('../db/supervisors');
const { insertSupervisorReport } = require('../db/supervisorReports');

const QUESTIONS = [
    { step: 'AWAITING_DATE',           key: 'date',           text: "Please enter the Date of this report in *DD/MM/YYYY* format (e.g., 10/06/2026)." },
    { step: 'AWAITING_SHOP',           key: 'shop',           text: "Please provide your score (1-5) and commentary on the *Shop*. (Or type *N/A*)" },
    { step: 'AWAITING_DELIVERY',       key: 'delivery',       text: "Please provide your score (1-5) and commentary on *Delivery*. (Or type *N/A*)" },
    { step: 'AWAITING_PROCUREMENT',    key: 'procurement',    text: "Please provide your score (1-5) and commentary on *Procurement*. (Or type *N/A*)" },
    { step: 'AWAITING_PRODUCTION',     key: 'production',     text: "Please provide your score (1-5) and commentary on *Production*. (Or type *N/A*)" },
    { step: 'AWAITING_WORKERS',        key: 'workers',        text: "Please provide your score (1-5) and commentary on *Workers*. (Or type *N/A*)" },
    { step: 'AWAITING_CASHING_OFFICE', key: 'cashing_office', text: "Please provide your score (1-5) and commentary on the *Cashing Office*. (Or type *N/A*)" },
    { step: 'AWAITING_SECURITY',       key: 'security',       text: "Please provide your score (1-5) and commentary on *Security*. (Or type *N/A*)" },
    { step: 'AWAITING_PACKING',        key: 'packing',        text: "Please provide your score (1-5) and commentary on *Packing*. (Or type *N/A*)" },
    { step: 'AWAITING_HYGIENE',        key: 'hygiene',        text: "Please provide your score (1-5) and commentary on *Hygiene*. (Or type *N/A*)" }
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
    if (currentQ.key === 'date') {
        // Enforce strict DD/MM/YYYY format
        const parts = input.split('/');
        const isValid = parts.length === 3 &&
            parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4 &&
            !isNaN(Date.parse(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`));

        if (!isValid) {
            await sock.sendMessage(jid, {
                text: `⚠️ Invalid date format. Please enter the date as *DD/MM/YYYY* (e.g., 10/06/2026).`
            });
            return true; // Stay on this step
        }

        const dateVal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        session.responses[currentQ.key] = dateVal;
    } else {
        if (input.toLowerCase() === 'n/a') {
            session.responses[currentQ.key] = { score: 'N/A', comment: 'N/A' };
        } else {
            let score = 3; // Default to 3
            let comment = input;
            
            const match = input.match(/^(\d)(.*)/s);
            if (match) {
                const parsedScore = parseInt(match[1], 10);
                if (parsedScore >= 1 && parsedScore <= 5) {
                    score = parsedScore;
                    comment = match[2].trim();
                }
            }

            // Auto-fill comment if none provided, based on score range
            if (!comment) {
                const autoComments = { 1: '⚠️ Very Poor', 2: '⚠️ Poor', 3: '✅ Average', 4: '✅ Good', 5: '✅ Excellent' };
                comment = autoComments[score] || '';
            }
            
            session.responses[currentQ.key] = { score, comment };
        }
    }

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

    const areas = [
        { key: 'shop', label: '🏪 *Shop:*' },
        { key: 'delivery', label: '🚚 *Delivery:*' },
        { key: 'procurement', label: '🛒 *Procurement:*' },
        { key: 'production', label: '🏭 *Production:*' },
        { key: 'workers', label: '👷 *Workers:*' },
        { key: 'cashing_office', label: '💰 *Cashing Office:*' },
        { key: 'security', label: '🔐 *Security:*' },
        { key: 'packing', label: '📦 *Packing:*' },
        { key: 'hygiene', label: '🧹 *Hygiene:*' }
    ];

    for (const area of areas) {
        const { score, comment } = responses[area.key];
        if (score === 'N/A') {
            reportText += `${area.label} [N/A — Not done today]\n\n`;
        } else {
            reportText += `${area.label} [Score: ${score}/5]\n${comment}\n\n`;
        }
    }

    try {
        // Save to DB
        const dbRecord = {
            report_date: responses.date,
            supervisor_number: senderNumber,
            branch: branch,
            shop_score: responses.shop.score === 'N/A' ? null : responses.shop.score,
            shop_comment: responses.shop.comment,
            delivery_score: responses.delivery.score === 'N/A' ? null : responses.delivery.score,
            delivery_comment: responses.delivery.comment,
            procurement_score: responses.procurement.score === 'N/A' ? null : responses.procurement.score,
            procurement_comment: responses.procurement.comment,
            production_score: responses.production.score === 'N/A' ? null : responses.production.score,
            production_comment: responses.production.comment,
            workers_score: responses.workers.score === 'N/A' ? null : responses.workers.score,
            workers_comment: responses.workers.comment,
            cashing_office_score: responses.cashing_office.score === 'N/A' ? null : responses.cashing_office.score,
            cashing_office_comment: responses.cashing_office.comment,
            security_score: responses.security.score === 'N/A' ? null : responses.security.score,
            security_comment: responses.security.comment,
            packing_score: responses.packing.score === 'N/A' ? null : responses.packing.score,
            packing_comment: responses.packing.comment,
            hygiene_score: responses.hygiene.score === 'N/A' ? null : responses.hygiene.score,
            hygiene_comment: responses.hygiene.comment
        };
        await insertSupervisorReport(dbRecord);

        // Send to group
        const groupId = process.env.SUPERVISOR_REPORT_GROUP_ID || process.env.FLEET_REPORT_GROUP_ID;
        if (!groupId) {
            console.error("No supervisor report group ID found in .env");
            await sock.sendMessage(jid, { text: "⚠️ Error: Supervisor group JID not configured. Sending report here instead." });
            await sock.sendMessage(jid, { text: reportText });
        } else {
            await sock.sendMessage(groupId, { text: reportText });
            await sock.sendMessage(jid, { text: "✅ Your report has been successfully saved and submitted to the Supervisor Group!" });
        }
    } catch (err) {
        console.error("Failed to send supervisor report:", err);
        await sock.sendMessage(jid, { text: "❌ Failed to submit the report. Please contact an admin." });
    }

    clearSession(jid);
}

module.exports = { startSupervisorReport, handleSupervisorReportStep };
