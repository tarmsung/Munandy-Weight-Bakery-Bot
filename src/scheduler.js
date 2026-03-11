const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const { getTodayRecords } = require('./db/records');
const { getAllSupervisors } = require('./db/supervisors');
const { generatePDFReport } = require('./reports/reportGenerator');
const { generateAIAnalysis } = require('./reports/aiAnalyzer');
const { getSocket } = require('./state');

// Folder to archive generated PDFs locally
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
fs.mkdirSync(REPORTS_DIR, { recursive: true });

function statusEmoji(status) {
    return status === 'Optimal' ? '✅' : status === 'Overweight' ? '🔴' : '🔵';
}

function buildSummaryText(records, dateLabel, aiAnalysis, flourKg = null) {
    const optimal = records.filter((r) => r.status === 'Optimal').length;
    const over = records.filter((r) => r.status === 'Overweight').length;
    const under = records.filter((r) => r.status === 'Underweight').length;

    let text = `📋 *End-of-Day Quality Control Report*\n_${dateLabel}_\n\n`;
    text += `Total Batches: *${records.length}*\nOverall: ✅ ${optimal}  |  🔴 ${over}  |  🔵 ${under}\n`;
    if (flourKg !== null) {
        text += `🌾 Flour Used Today: *${flourKg} kg*\n`;
    }
    text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Group by branch
    const grouped = {};
    for (const r of records) {
        const branch = r.branch || 'Unknown';
        if (!grouped[branch]) grouped[branch] = [];
        grouped[branch].push(r);
    }

    for (const [branch, branchRecords] of Object.entries(grouped)) {
        text += `\n🏢 *${branch.toUpperCase()}*\n`;
        for (const r of branchRecords) {
            const variance = r.variance >= 0 ? `+${r.variance}g` : `${r.variance}g`;
            text +=
                `${statusEmoji(r.status)} *${r.product_name}*  —  ` +
                `Avg: ${Math.round(r.average)}g  |  Variance: ${variance}`;
            if (r.quantity) text += `  |  Qty: ${r.quantity}`;
            text += '\n';
        }
    }

    if (aiAnalysis) {
        text += `\n🤖 *AI Analysis:*\n_${aiAnalysis}_\n`;
    }

    text += `\n_Full details in the attached PDF._`;
    return text;
}

async function sendEndOfDayReport() {
    const sock = getSocket();
    if (!sock) {
        console.warn('⚠️  No active socket — skipping EOD report.');
        return;
    }

    const adminNumsStr = process.env.ADMIN_NUMBERS || '';
    const adminNums = adminNumsStr.split(',').map(n => n.trim()).filter(Boolean);

    if (adminNums.length === 0) {
        console.warn('⚠️  ADMIN_NUMBERS not set in .env — skipping EOD report.');
        return;
    }

    const records = await getTodayRecords();
    const dateLabel = new Date().toLocaleDateString('en-ZA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const dateStr = new Date().toISOString().split('T')[0];

    // Recipients: only admins get the Master Report now in their DMs
    const recipients = [...adminNums];

    if (records.length === 0) {
        for (const num of recipients) {
            await sock.sendMessage(`${num}@s.whatsapp.net`, {
                text: `📭 *End-of-Day Report*\n_${dateLabel}_\n\nNo weight records were recorded today.`,
            });
        }
        console.log('📊 EOD report sent (no records today).');
        return;
    }

    const aiAnalysis = await generateAIAnalysis(records);
    const summaryText = buildSummaryText(records, dateLabel, aiAnalysis);
    const pdfBuffer = await generatePDFReport(records, dateLabel, aiAnalysis);

    // Archive PDF locally
    const pdfPath = path.join(REPORTS_DIR, `report_${dateStr}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    // Send Master Report to Admins & Supervisors
    for (const num of recipients) {
        const jid = `${num}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: summaryText });
        await sock.sendMessage(jid, {
            document: pdfBuffer,
            fileName: `QC_Report_${dateStr}.pdf`,
            mimetype: 'application/pdf',
        });
        console.log(`📊 EOD master report sent to ${num}`);
    }

    // ── Send Branch-Specific Reports to Groups ────────────────────────────────
    const branchGroups = {
        'Harare': process.env.HARARE_GROUP_ID,
        'Mutare': process.env.MUTARE_GROUP_ID,
        'Bulawayo': process.env.BULAWAYO_GROUP_ID
    };

    for (const [branch, groupId] of Object.entries(branchGroups)) {
        if (!groupId) continue;

        const branchRecords = records.filter(r => (r.branch || 'Unknown').toLowerCase() === branch.toLowerCase());

        if (branchRecords.length === 0) {
            await sock.sendMessage(groupId, {
                text: `📭 *End-of-Day Report - ${branch}*\n_${dateLabel}_\n\nNo weight records were recorded for this branch today.`,
            });
            console.log(`📊 EOD branch report sent to ${branch} group (no records).`);
            continue;
        }

        const branchAiAnalysis = await generateAIAnalysis(branchRecords);
        const branchSummaryText = buildSummaryText(branchRecords, dateLabel, branchAiAnalysis);
        const branchPdfBuffer = await generatePDFReport(branchRecords, dateLabel, branchAiAnalysis);

        await sock.sendMessage(groupId, { text: branchSummaryText });
        await sock.sendMessage(groupId, {
            document: branchPdfBuffer,
            fileName: `QC_${branch}_Report_${dateStr}.pdf`,
            mimetype: 'application/pdf',
        });
        console.log(`📊 EOD branch report sent to ${branch} group.`);
    }
}

/**
 * Manually generate and send a report for a specific branch.
 */
async function sendBranchReport(branchName, flourKg = null) {
    const sock = getSocket();
    if (!sock) {
        console.warn(`⚠️ No active socket — cannot send report for ${branchName}.`);
        return false;
    }

    const branchKey = Object.keys(process.env).find(k => k.startsWith(branchName.toUpperCase()) && k.endsWith('_GROUP_ID'));
    const groupId = process.env[branchKey];

    if (!groupId) {
        console.warn(`⚠️ No group ID configured for branch: ${branchName}`);
        return false;
    }

    const records = await getTodayRecords();
    const branchRecords = records.filter(r => (r.branch || 'Unknown').toLowerCase() === branchName.toLowerCase());

    const dateLabel = new Date().toLocaleDateString('en-ZA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const dateStr = new Date().toISOString().split('T')[0];

    if (branchRecords.length === 0) {
        await sock.sendMessage(groupId, {
            text: `📭 *Manual Report Triggered - ${branchName}*\n_${dateLabel}_\n\nNo weight records have been recorded for this branch today.`,
        });
        return true;
    }

    const branchAiAnalysis = await generateAIAnalysis(branchRecords);
    const branchSummaryText = buildSummaryText(branchRecords, dateLabel, branchAiAnalysis, flourKg);
    const branchPdfBuffer = await generatePDFReport(branchRecords, dateLabel, branchAiAnalysis, flourKg);

    await sock.sendMessage(groupId, { text: branchSummaryText });
    await sock.sendMessage(groupId, {
        document: branchPdfBuffer,
        fileName: `QC_${branchName}_Report_${dateStr}.pdf`,
        mimetype: 'application/pdf',
    });

    console.log(`📊 Manual branch report sent to ${branchName} group.`);
    return true;
}

async function checkMorningSubmissions() {
    const sock = getSocket();
    if (!sock) {
        console.warn('⚠️  No active socket — skipping morning check.');
        return;
    }

    const records = await getTodayRecords();

    // Group records by branch
    const recordedBranches = new Set();
    for (const r of records) {
        if (r.branch) recordedBranches.add(r.branch.toLowerCase());
    }

    // ── Check Each Branch ────────────────────────────────
    const branchGroups = {
        'Harare': process.env.HARARE_GROUP_ID,
        'Mutare': process.env.MUTARE_GROUP_ID,
        'Bulawayo': process.env.BULAWAYO_GROUP_ID
    };

    const missingBranches = [];
    for (const [branch, groupId] of Object.entries(branchGroups)) {
        if (!groupId) continue;

        if (!recordedBranches.has(branch.toLowerCase())) {
            missingBranches.push(branch);
        }
    }

    if (missingBranches.length > 0) {
        const adminNumsStr = process.env.ADMIN_NUMBERS || '';
        const adminNums = adminNumsStr.split(',').map(n => n.trim()).filter(Boolean);

        const alertText = `⚠️ *Morning Report Missing*\n\nNo weight records have been submitted for the following branches yet today:\n\n` +
            missingBranches.map(b => `• *${b}*`).join('\n') +
            `\n\n_Please follow up with the supervisors._`;

        for (const num of adminNums) {
            await sock.sendMessage(`${num}@s.whatsapp.net`, { text: alertText });
            console.log(`⏰ Sent morning reminder to admin ${num} about branches: ${missingBranches.join(', ')}`);
        }
    }
}

function startScheduler() {
    // End-of-Day auto report is now disabled; triggered manually by supervisors via "3️⃣ Submit Report"
    /*
    const cronExpr = process.env.REPORT_TIME || '0 18 * * *';
    cron.schedule(
        cronExpr,
        () => {
            console.log('⏰ Running end-of-day report...');
            sendEndOfDayReport().catch((err) =>
                console.error('❌ EOD report error:', err.message)
            );
        },
        { timezone: 'Africa/Johannesburg' }
    );
    console.log(`⏰ Scheduler started — EOD report at ${cronExpr} (Africa/Johannesburg)`);
    */

    // Morning Check: 9:00 AM daily
    const morningCronExpr = process.env.MORNING_CHECK_TIME || '0 9 * * *';
    cron.schedule(
        morningCronExpr,
        () => {
            console.log('⏰ Running morning submission check...');
            checkMorningSubmissions().catch((err) =>
                console.error('❌ Morning check error:', err.message)
            );
        },
        { timezone: 'Africa/Johannesburg' }
    );
    console.log(`⏰ Scheduler started — Morning check at ${morningCronExpr} (Africa/Johannesburg)`);
}

module.exports = { startScheduler, sendEndOfDayReport, sendBranchReport, checkMorningSubmissions };
