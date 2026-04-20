const cron = require('node-cron');
const { 
    getUnfiledReports, 
    getDailyFaults, 
    getFaultStreaks, 
    getResolvedIssues, 
    getMaintenanceDue, 
    getInsuranceDue,
    checkReportExists,
    saveDailyReport,
    markReportSent
} = require('../db/reportQueries');
const { getClaudeAnalysis } = require('./claudeAnalysis');
const { buildFleetReportMessage } = require('./reportBuilder');
const supabase = require('../db/supabase');
const { getSocket } = require('../state');

/**
 * Main function to run the daily fleet report.
 */
async function runDailyFleetReport(isManual = false) {
    const sock = getSocket();
    if (!sock) {
        console.warn(`[${new Date().toISOString()}] ⚠️ No active socket — skipping daily fleet report.`);
        return;
    }

    const reportDate = new Date().toISOString().split('T')[0];
    
    console.log(`[${new Date().toISOString()}] 📋 Starting automated daily fleet report for ${reportDate}...`);

    try {
        // Step 1: Guard against duplicate run
        if (!isManual) {
            const exists = await checkReportExists(reportDate);
            if (exists) {
                console.warn(`[${new Date().toISOString()}] ⚠️ Fleet report for today (${reportDate}) already exists. Skipping.`);
                return;
            }
        }

        // Step 2: Run all queries in parallel
        console.log(`[${new Date().toISOString()}] 🔍 Running parallel database queries...`);
        const [
            unfiled,
            faults,
            streaks,
            resolved,
            maintenance,
            insurance,
            allVehicles
        ] = await Promise.all([
            getUnfiledReports(reportDate),
            getDailyFaults(reportDate),
            getFaultStreaks(reportDate),
            getResolvedIssues(reportDate),
            getMaintenanceDue(reportDate),
            getInsuranceDue(reportDate),
            supabase.from('vehicles').select('registration, make, nickname').eq('is_active', true)
        ]);

        if (allVehicles.error) throw allVehicles.error;

        // Step 3: Derive Well-Performing Vehicles (Section 4)
        // Vehicles that submitted (not in unfiled) and have no faults
        const unfiledRegs = new Set(unfiled.map(v => v.registration));
        const faultedRegs = new Set(faults.map(f => f.registration));
        
        // We need drivers for well-performing section, but Q2 only gives faults drivers
        // Let's get all today's reports to find drivers for well-performing ones
        // Fetch today's submissions — plain select, no FK join
        const { data: todaySubmissions } = await supabase
            .from('inspection_reports')
            .select('vehicle_registration, driver_id')
            .gte('submitted_at', `${reportDate}T00:00:00`)
            .lte('submitted_at', `${reportDate}T23:59:59`);

        // Fetch drivers for name lookup
        const { data: allDrivers } = await supabase
            .from('drivers')
            .select('id, name');
        const driverMap = new Map((allDrivers || []).map(d => [String(d.id), d]));

        const wellPerforming = [];
        (todaySubmissions || []).forEach(sub => {
            if (!faultedRegs.has(sub.vehicle_registration)) {
                const vehicle = allVehicles.data.find(v => v.registration === sub.vehicle_registration);
                if (vehicle) {
                    wellPerforming.push({
                        ...vehicle,
                        driver_name: driverMap.get(String(sub.driver_id))?.name || 'Unknown'
                    });
                }
            }
        });

        const reportData = {
            unfiled,
            faults,
            streaks,
            resolved,
            maintenance,
            insurance,
            wellPerforming
        };

        // Step 4: Generate AI analysis via Claude
        console.log(`[${new Date().toISOString()}] 🤖 Generating Claude AI analysis...`);
        reportData.suggestions = await getClaudeAnalysis(reportData);

        // Step 5: Assemble message
        const message = buildFleetReportMessage(reportData, reportDate);

        // Step 6: Save report to DB (only for automated runs)
        if (!isManual) {
            console.log(`[${new Date().toISOString()}] 💾 Saving report payload to database...`);
            await saveDailyReport(reportDate, reportData);
        }

        // Step 7: Send message with retries
        const notifyJid = process.env.FLEET_REPORT_GROUP_ID || process.env.NOTIFY_GROUP_JID;
        if (!notifyJid) {
            console.warn(`[${new Date().toISOString()}] ⚠️ FLEET_REPORT_GROUP_ID or NOTIFY_GROUP_JID not set. Cannot send report.`);
            return;
        }

        let sent = false;
        let retries = 0;
        const maxRetries = 3;

        while (!sent && retries <= maxRetries) {
            try {
                console.log(`[${new Date().toISOString()}] 📤 Sending report to group (Attempt ${retries + 1})...`);
                await sock.sendMessage(notifyJid, { text: message });
                sent = true;
                if (!isManual) {
                    await markReportSent(reportDate);
                }
                console.log(`[${new Date().toISOString()}] ✅ Daily fleet report successfully sent!`);
            } catch (err) {
                console.error(`[${new Date().toISOString()}] ❌ Failed to send report (Attempt ${retries + 1}):`, err.message);
                retries++;
                if (retries <= maxRetries) {
                    console.log(`[${new Date().toISOString()}] ⏳ Retrying in 10 seconds...`);
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }
        }

        if (!sent) {
            console.error(`[${new Date().toISOString()}] 🚨 All attempts to send the daily fleet report failed.`);
        }

    } catch (err) {
        console.error(`[${new Date().toISOString()}] 🚨 Fatal error in daily fleet report:`, err);
    }
}

/**
 * Initializes the cron job for the daily fleet report.
 */
function initDailyFleetReportCron() {
    // Hardcoded to 6:00 PM (18:00) Harare time
    const reportTime = '0 18 * * *';
    
    cron.schedule(reportTime, () => {
        console.log(`[${new Date().toISOString()}] ⏰ Cron triggered — running daily fleet report...`);
        runDailyFleetReport(false).catch((err) =>
            console.error(`[${new Date().toISOString()}] ❌ Daily fleet report error:`, err.message)
        );
    }, {
        timezone: "Africa/Johannesburg"
    });

    console.log(`⏰ Daily Fleet Report hardcoded for ${reportTime} (Africa/Johannesburg)`);
}

module.exports = { initDailyFleetReportCron, runDailyFleetReport };
