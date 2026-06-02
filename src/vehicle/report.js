require('dotenv').config();

/**
 * Sends the final report to the configured WhatsApp group as a formatted text message.
 */
async function sendReportToGroup(sock, sessionData) {
    const notifyJid = process.env.NOTIFY_GROUP_JID;
    if (!notifyJid) {
        console.warn('NOTIFY_GROUP_JID is not configured in .env. Skipping group notification.');
        return;
    }

    const {
        driverName,
        branch,
        vehicleMake,
        vehicleModel,
        vehicleReg,
        checklistResults,
        comments,
        isEdited,
        inspectorName,
        inspectorBranch
    } = sessionData;

    const dateStr = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
    const okCount = checklistResults.filter(r => r.status === 'OK').length;
    const faults = checklistResults.filter(r => r.status !== 'OK');
    const faultCount = faults.length;

    let reportText = '';

    if (isEdited) {
        reportText += `⚠️ *CORRECTED REPORT* ⚠️\n\n`;
    }

    reportText += `🚐 *Vehicle Inspection Report*\n` +
        `*Date & Time:* ${dateStr}\n\n` +
        `*Vehicle:* ${vehicleMake} ${vehicleModel} (${vehicleReg})\n` +
        `*Inspector:* ${inspectorName} (${inspectorBranch})\n` +
        `*Driver:* ${driverName} (${branch})\n\n` +
        `*Summary:* ✅ ${okCount} OK | ❌ ${faultCount} Faults\n`;

    reportText += `\n🔧 *Faults Reported:*\n`;
    if (faultCount > 0) {
        reportText += faults.map(f => `• *${f.item}:* ${f.fault_description}`).join('\n');
    } else {
        reportText += `• None`;
    }

    reportText += `\n\n💬 *Additional Comments:*\n`;
    if (comments && comments !== 'none' && comments.trim() !== '') {
        reportText += comments;
    } else {
        reportText += `None provided.`;
    }

    try {
        console.log('Sending report text to group...');
        await sock.sendMessage(notifyJid, { text: reportText });
        console.log('Report successfully sent to group.');
    } catch (err) {
        console.error('Failed to send report text to group:', err);
    }
}

module.exports = {
    sendReportToGroup
};
