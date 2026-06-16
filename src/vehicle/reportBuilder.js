/**
 * Assembles the daily fleet report into a WhatsApp-formatted string based on a specific template.
 */
function buildFleetReportMessage(reportData, reportDate) {
    const {
        unfiled = [],
        faults = [],
        streaks = [],
        resolved = [],
        maintenance = [],
        insurance = [],
        wellPerforming = [],
        aiInsights = {}
    } = reportData;

    const patternAlerts = aiInsights.pattern_alerts || [];
    const escalationSentence = aiInsights.escalation_sentence || `⚠️ Zero issues resolved today. Direct supervisor intervention required.`;

    const criticalItemsList = [
        "Is the car running?",
        "Brake Fluid", 
        "Brake Lights", 
        "Oil", 
        "Leaks (Oil, Radiator, diesel, pipes)", 
        "Tyre Pressure"
    ];

    const dateObj = new Date(reportDate);
    const dateLabel = dateObj.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    let message = `🚐 *MUNANDY BAKERY — DAILY FLEET REPORT*\n📅 ${dateLabel}\n\n---\n\n`;

    // Separate critical vs non-critical faults
    const criticalFaults = faults.filter(f => criticalItemsList.includes(f.item));
    const nonCriticalFaults = faults.filter(f => !criticalItemsList.includes(f.item));

    // Helper to group faults by vehicle
    const groupFaultsByVehicle = (faultList) => {
        const map = new Map();
        for (const f of faultList) {
            if (!map.has(f.registration)) {
                map.set(f.registration, {
                    registration: f.registration,
                    make: f.make || '',
                    nickname: f.nickname || '',
                    driver_name: f.driver_name || 'Unknown',
                    faults: []
                });
            }
            map.get(f.registration).faults.push(f);
        }
        return Array.from(map.values());
    };

    // 1. VEHICLES OFF-ROAD / GROUNDED
    message += `*🔴 VEHICLES OFF-ROAD / GROUNDED*\n\n`;
    const groundedVehicles = groupFaultsByVehicle(criticalFaults);
    
    if (groundedVehicles.length === 0) {
        message += `No critical issues today ✅\n\n`;
    } else {
        groundedVehicles.forEach(v => {
            message += `• *${v.registration}* — ${v.make} ${v.nickname} | Driver: ${v.driver_name}\n`;
            
            // Collect all faults for this vehicle (even non-critical ones, so they aren't lost)
            const allVehicleFaults = faults.filter(f => f.registration === v.registration);
            const descriptions = allVehicleFaults.map(f => f.description || f.item).join(' + ');
            
            // Add the grounding instruction
            let instruction = "*Grounded immediately.*";
            if (descriptions.toLowerCase().includes('engine') || descriptions.toLowerCase().includes('knocked')) {
                instruction = "*Ground immediately pending assessment.*";
            } else if (descriptions.toLowerCase().includes('ignition')) {
                instruction = "*Do not dispatch.*";
            }
            
            message += `  ↳ ${descriptions}. ${instruction}\n\n`;
        });
    }

    message += `---\n\n`;

    // Inject Pattern Alerts if any
    if (patternAlerts.length > 0) {
        message += `*🔍 AI PATTERN ALERTS*\n`;
        patternAlerts.forEach(alert => {
            message += `• ${alert}\n`;
        });
        message += `\n---\n\n`;
    }

    // 1.5 OTHER REPORTED FAULTS
    // To prevent data loss, we must list non-critical faults for vehicles that are NOT grounded.
    // Grounded vehicles already had ALL their faults listed above.
    const groundedRegs = new Set(groundedVehicles.map(v => v.registration));
    const standaloneNonCriticalFaults = nonCriticalFaults.filter(f => !groundedRegs.has(f.registration));
    
    if (standaloneNonCriticalFaults.length > 0) {
        message += `*🟡 OTHER REPORTED FAULTS*\n\n`;
        const otherVehicles = groupFaultsByVehicle(standaloneNonCriticalFaults);
        otherVehicles.forEach(v => {
            const descriptions = v.faults.map(f => f.description || f.item).join(' + ');
            message += `• *${v.registration}* — ${v.make} ${v.nickname} | Driver: ${v.driver_name}\n`;
            message += `  ↳ ${descriptions}\n\n`;
        });
        message += `---\n\n`;
    }

    // 2. RECURRING FAULTS — ESCALATION REQUIRED
    message += `*🟠 RECURRING FAULTS — ESCALATION REQUIRED*\n`;
    message += `_(Unresolved for 3+ days — workshop action needed)_\n\n`;

    if (streaks.length === 0) {
        message += `No recurring issues 🎉\n\n`;
    } else {
        streaks.forEach(s => {
            // Add warning icon for >= 5 days
            const warningIcon = s.streak >= 5 ? " ⚠️" : "";
            message += `• *${s.registration} (${s.make} ${s.nickname})* — ${s.item} [${s.streak} days]${warningIcon}\n`;
        });
        message += `\n${escalationSentence}\n\n`;
    }

    message += `---\n\n`;

    // 3. MISSING SUBMISSION
    message += `*📝 MISSING SUBMISSION*\n\n`;
    if (unfiled.length === 0) {
        message += `All vehicles submitted today ✅\n\n`;
    } else {
        unfiled.forEach(v => {
            message += `• *${v.registration}* — ${v.make} ${v.nickname || ''} has not submitted today's report.\n`;
        });
        message += `\n`;
    }

    message += `---\n\n`;

    // 4. WELL-PERFORMING VEHICLES
    message += `*✅ WELL-PERFORMING VEHICLES*\n\n`;
    if (wellPerforming && wellPerforming.length > 0) {
        wellPerforming.forEach(v => {
            message += `• *${v.registration}* — ${v.make} ${v.nickname} | ${v.driver_name}\n`;
        });
        message += `\n`;
    } else {
        message += `No fully clear vehicles today.\n\n`;
    }

    message += `---\n\n`;

    // 5. SERVICE & INSURANCE DUE
    const serviceString = maintenance.length === 0 
        ? "None in next 2 weeks ✅" 
        : maintenance.map(m => `${m.registration} (${m.type} on ${m.date})`).join(', ');
        
    const insuranceString = insurance.length === 0 
        ? "None in next 2 weeks ✅" 
        : insurance.map(i => `${i.registration} (${i.date})`).join(', ');

    message += `*🔧 SERVICE / SUSPENSION DUE:* ${serviceString}\n`;
    message += `*📋 INSURANCE DUE:* ${insuranceString}\n`;

    return message;
}

module.exports = { buildFleetReportMessage };
