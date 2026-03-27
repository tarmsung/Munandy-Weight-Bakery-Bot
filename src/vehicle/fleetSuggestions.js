/**
 * Generates actionable suggestions based on fleet report data.
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

    const suggestions = [];

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
        criticalFaults.slice(0, 2).forEach(f => {
            suggestions.push(`CRITICAL: ${f.make} ${f.nickname} (${f.registration}) has safety issues (${f.item}). Ground vehicle until repaired.`);
        });
    }

    // 2. Unfiled Reports
    if (unfiled.length > 2) {
        suggestions.push(`Urgent: ${unfiled.length} vehicles have missing reports today. Verify submissions with drivers immediately.`);
    } else if (unfiled.length > 0) {
        suggestions.push(`Reminder: Follow up with drivers of ${unfiled.map(v => v.nickname || v.registration).join(', ')} for today's checklist.`);
    }

    // 3. Recurring Issues (Streaks)
    if (streaks.length > 0) {
        const topStreak = streaks[0];
        suggestions.push(`RECURRING: ${topStreak.nickname} ${topStreak.item} has been a fault for ${topStreak.streak} days. Requires technical review.`);
    }

    // 4. Maintenance Due
    if (maintenance.length > 0) {
        const soonest = maintenance[0];
        suggestions.push(`SCHEDULE: ${soonest.nickname} is due for ${soonest.type} on ${soonest.date}. Arrange workshop slot.`);
    }

    // 5. Insurance Due
    if (insurance.length > 0) {
        const soonest = insurance[0];
        suggestions.push(`RENEWAL: Insurance for ${soonest.nickname} expires on ${soonest.date}. Contact broker for policy renewal.`);
    }

    // 6. Resolved Issues Positive Reinforcement
    if (resolved.length > 0 && suggestions.length < 6) {
        suggestions.push(`Great work: ${resolved.length} previous faults were resolved today across the fleet.`);
    }

    // 7. General Status
    if (suggestions.length === 0) {
        return "1. Fleet operations appear normal today.\n2. All vehicles submitted or no major issues found.\n3. Monitor upcoming maintenance schedules.";
    }

    // Format as numbered list, max 6 suggestions
    return suggestions
        .slice(0, 6)
        .map((s, i) => `${i + 1}. ${s}`)
        .join('\n');
}

module.exports = { getFleetSuggestions };
