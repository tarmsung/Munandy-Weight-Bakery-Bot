/**
 * Assembles the daily fleet report into a WhatsApp-formatted string.
 */
function buildFleetReportMessage(reportData, reportDate) {
    const {
        unfiled = [],
        faults = [],
        streaks = [],
        resolved = [],
        maintenance = [],
        insurance = [],
        suggestions = ""
    } = reportData;

    // Critical items for filtering section 2
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
    }).toUpperCase();

    let message = `Hello, I am the Munandy Bakery AI Agent.\n`;
    message += `Here is the vehicle inventory summary for today, *${dateLabel}*:\n\n`;

    // 1. Vehicles that haven't submitted today 📝
    message += `*1. Vehicles that haven't submitted today 📝*\n`;
    if (unfiled.length === 0) {
        message += `All vehicles submitted today ✅\n`;
    } else {
        message += unfiled.map(v => `${v.make} ${v.nickname || ''} - ${v.registration}`).join('\n') + `\n`;
    }
    message += `\n`;

    // 2. Vehicles with critical challenges ⚠️
    message += `*2. Vehicles with critical challenges ⚠️*\n`;
    const criticalFaults = faults.filter(f => criticalItemsList.includes(f.item));
    if (criticalFaults.length === 0) {
        message += `No critical issues today ✅\n`;
    } else {
        message += criticalFaults.map(f => `*${f.make} ${f.nickname} (${f.registration})* driven by ${f.driver_name}: ${f.description || f.item}`).join('\n') + `\n`;
    }
    message += `\n`;

    // 3. Vehicles with same problem for 3 or more days 🔄
    message += `*3. Vehicles with same problem for 3 or more days 🔄*\n`;
    if (streaks.length === 0) {
        message += `No recurring issues 🎉\n`;
    } else {
        message += streaks.map(s => {
            const firstDateObj = new Date(s.firstDate);
            const firstDateLabel = firstDateObj.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
            return `*${s.make} ${s.nickname} (${s.registration}):* ${s.item} for ${s.streak} days. Reported since ${firstDateLabel}.`;
        }).join('\n') + `\n`;
    }
    message += `\n`;

    // 4. Other insights (Well-performing vehicles) ✅
    message += `*4. Other insights (Well-performing vehicles) ✅*\n`;
    message += `These vehicles have no major issues reported today.\n`;
    // Filter vehicles that submitted (not in unfiled) and have no faults at all
    // Since we only have 'faults' list, we need to cross-ref
    // This is a bit tricky without the full list of submissions here, 
    // but we can derive it if we had 'allVehicles' and 'unfiled'.
    // Let's assume reportData includes allSubmissions for this purpose or we just use what we have.
    const vehiclesWithFaults = new Set(faults.map(f => f.registration));
    // We'll need the list of vehicles that DID submit. 
    // For now, let's use a placeholder if we don't have the full list, 
    // or better, ensure reportData has 'wellPerforming'.
    if (reportData.wellPerforming && reportData.wellPerforming.length > 0) {
        message += reportData.wellPerforming.map(v => `*${v.make} ${v.nickname} (${v.registration})* driven by ${v.driver_name}`).join('\n') + `\n`;
    } else {
        message += `No fully clear vehicles today.\n`;
    }
    message += `\n`;

    // 5. Vehicles with issues solved 🛠️
    message += `*5. Vehicles with issues solved 🛠️*\n`;
    if (resolved.length === 0) {
        message += `No resolved issues today.\n`;
    } else {
        message += resolved.map(r => `*${r.make} ${r.nickname} (${r.registration}):* ${r.item} now resolved.`).join('\n') + `\n`;
    }
    message += `\n`;

    // 6. AI Analysis 🤖
    message += `*6. AI Analysis 🤖*\n`;
    message += (suggestions || "No suggestions available.") + `\n\n`;

    // 7. Service or Suspension due in the next 2 weeks 🔧
    message += `*7. Service or Suspension due in the next 2 weeks 🔧*\n`;
    if (maintenance.length === 0) {
        message += `No service or suspension due in the next 2 weeks ✅\n`;
    } else {
        message += maintenance.map(m => `*${m.make} ${m.nickname} (${m.registration}):* ${m.type} is due on ${m.date}.`).join('\n') + `\n`;
    }
    message += `\n`;

    // 8. Insurance due in the next 2 weeks 📜
    message += `*8. Insurance due in the next 2 weeks 📜*\n`;
    if (insurance.length === 0) {
        message += `No insurance renewals due in the next 2 weeks ✅\n`;
    } else {
        message += insurance.map(i => `*${i.make} ${i.nickname} (${i.registration}):* Insurance is due on ${i.date}.`).join('\n') + `\n`;
    }

    return message;
}

module.exports = { buildFleetReportMessage };
