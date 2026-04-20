/**
 * Generates actionable management recommendations based on fleet report data (Fallback logic).
 * matched to the persona: Munandy Bakery AI Fleet Agent.
 * @param {Object} reportData
 * @returns {string}
 */
function getFleetSuggestions(reportData) {
    const {
        unfiled = [],
        faults = [],
        streaks = [],
        resolved = [],
        maintenance = [],
        insurance = []
    } = reportData;

    const sections = [];

    // CRITICAL ITEMS LIST
    const criticalItems = [
        "Is the car running?",
        "Brake Fluid", 
        "Brake Lights", 
        "Oil", 
        "Leaks (Oil, Radiator, diesel, pipes)", 
        "Tyre Pressure"
    ];

    // 1. Critical Faults
    const criticalFaults = faults.filter(f => criticalItems.includes(f.item));
    if (criticalFaults.length > 0) {
        let text = "The following vehicles must be grounded immediately until safety-critical repairs are verified: ";
        text += criticalFaults.map(f => `${f.make} ${f.nickname} (${f.registration}) due to ${f.item}`).join(', ') + ".";
        sections.push(text);
    }

    // 2. Overdue/Recurring Issues
    if (streaks.length > 0) {
        let text = "Fault management is required for recurrent issues identified today. Specifically, ";
        text += streaks.map(s => `${s.nickname} has reported "${s.item}" for ${s.streak} consecutive days`).join(', ') + ". These vehicles require immediate workshop attention.";
        sections.push(text);
    }

    // 3. Operational Compliance (Unfiled)
    if (unfiled.length > 0) {
        let text = `Administrative follow-up is mandatory for ${unfiled.length} vehicles that failed to submit reports today. `;
        text += `Drivers for ${unfiled.slice(0, 3).map(v => v.nickname || v.registration).join(', ')} must be held accountable for non-compliance.`;
        sections.push(text);
    }

    // 4. Legal & Maintenance Risks
    if (maintenance.length > 0 || insurance.length > 0) {
        let text = "The following legal and maintenance risks require immediate scheduling: ";
        const combined = [
            ...maintenance.map(m => `${m.nickname} (Service due ${m.date})`),
            ...insurance.map(i => `${i.nickname} (Insurance expires ${i.date})`)
        ];
        text += combined.slice(0, 3).join(', ') + ".";
        sections.push(text);
    }

    // 5. Resolution & Recognition
    if (resolved.length > 0) {
        sections.push(`Positive recognition is noted for the resolution of ${resolved.length} previously reported faults across the fleet today.`);
    }

    // fallback if no data
    if (sections.length < 3) {
        sections.push("Fleet status is currently under observation with no immediate safety-critical escalations required.");
        sections.push("Ensure all drivers continue to maintain rigorous submission standards for daily inspections.");
        sections.push("Monitor the upcoming maintenance schedule to prevent any operational downtime.");
    }

    // Format as 5-6 numbered paragraphs
    while (sections.length < 5) {
        sections.push("Maintain standard operational oversight and ensure all vehicle safety logs are updated by the next shift.");
    }

    return sections
        .slice(0, 6)
        .map(s => `\u2022 ${s}`)
        .join('\n\n');
}

module.exports = { getFleetSuggestions };
