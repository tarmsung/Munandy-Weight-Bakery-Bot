const Anthropic = require('@anthropic-ai/sdk');
const { getFleetSuggestions } = require('./fleetSuggestions');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Builds a structured context string from fleet report data for Claude's prompt.
 * @param {Object} reportData
 * @returns {string}
 */
function buildFleetContext(reportData) {
    const {
        unfiled = [],
        faults = [],
        streaks = [],
        resolved = [],
        maintenance = [],
        insurance = [],
        wellPerforming = []
    } = reportData;

    const criticalItems = [
        "Is the car running?",
        "Brake Fluid",
        "Brake Lights",
        "Oil",
        "Leaks (Oil, Radiator, diesel, pipes)",
        "Tyre Pressure"
    ];

    const criticalFaults = faults.filter(f => criticalItems.includes(f.item));
    const nonCriticalFaults = faults.filter(f => !criticalItems.includes(f.item));

    let context = `MUNANDY BAKERY TRANSPORT FLEET — DAILY STATUS REPORT\n`;
    context += `=======================================================\n\n`;

    // Unfiled
    context += `VEHICLES NOT SUBMITTED TODAY (${unfiled.length}):\n`;
    if (unfiled.length === 0) {
        context += `  All vehicles submitted their checklist today.\n`;
    } else {
        unfiled.forEach(v => {
            context += `  - ${v.make} ${v.nickname || ''} (${v.registration})\n`;
        });
    }

    // Critical faults
    context += `\nCRITICAL SAFETY FAULTS (${criticalFaults.length}):\n`;
    if (criticalFaults.length === 0) {
        context += `  No critical safety issues reported today.\n`;
    } else {
        criticalFaults.forEach(f => {
            context += `  - ${f.make} ${f.nickname} (${f.registration}) — ${f.item}: ${f.description || 'No description'} [Driver: ${f.driver_name}]\n`;
        });
    }

    // Non-critical faults
    context += `\nOTHER REPORTED FAULTS (${nonCriticalFaults.length}):\n`;
    if (nonCriticalFaults.length === 0) {
        context += `  No other faults reported today.\n`;
    } else {
        nonCriticalFaults.forEach(f => {
            context += `  - ${f.make} ${f.nickname} (${f.registration}) — ${f.item}: ${f.description || 'No description'}\n`;
        });
    }

    // Recurring issues
    context += `\nRECURRING ISSUES (3+ days, ${streaks.length}):\n`;
    if (streaks.length === 0) {
        context += `  No recurring faults today.\n`;
    } else {
        streaks.forEach(s => {
            context += `  - ${s.make} ${s.nickname} (${s.registration}) — "${s.item}" for ${s.streak} consecutive days.\n`;
        });
    }

    // Well performing
    context += `\nWELL-PERFORMING VEHICLES (${wellPerforming.length}):\n`;
    if (wellPerforming.length === 0) {
        context += `  No fully clear vehicles today.\n`;
    } else {
        wellPerforming.forEach(v => {
            context += `  - ${v.make} ${v.nickname} (${v.registration}) [Driver: ${v.driver_name}]\n`;
        });
    }

    // Resolved
    context += `\nISSUES RESOLVED TODAY (${resolved.length}):\n`;
    if (resolved.length === 0) {
        context += `  No previously reported faults were resolved today.\n`;
    } else {
        resolved.forEach(r => {
            context += `  - ${r.make} ${r.nickname} (${r.registration}) — "${r.item}" now resolved.\n`;
        });
    }

    // Maintenance
    context += `\nUPCOMING MAINTENANCE / SERVICE (${maintenance.length}):\n`;
    if (maintenance.length === 0) {
        context += `  No service or suspension due in the next 2 weeks.\n`;
    } else {
        maintenance.forEach(m => {
            context += `  - ${m.make} ${m.nickname} (${m.registration}) — ${m.type} due on ${m.date}.\n`;
        });
    }

    // Insurance
    context += `\nUPCOMING INSURANCE RENEWALS (${insurance.length}):\n`;
    if (insurance.length === 0) {
        context += `  No insurance renewals due in the next 2 weeks.\n`;
    } else {
        insurance.forEach(i => {
            context += `  - ${i.make} ${i.nickname} (${i.registration}) — Insurance due on ${i.date}.\n`;
        });
    }

    return context;
}

/**
 * Calls Claude AI to generate an intelligent fleet analysis.
 * Falls back to rule-based suggestions if the API call fails.
 * @param {Object} reportData
 * @returns {Promise<string>}
 */
async function getClaudeAnalysis(reportData) {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn(`[${new Date().toISOString()}] ⚠️ ANTHROPIC_API_KEY not set. Falling back to rule-based suggestions.`);
        return getFleetSuggestions(reportData);
    }

    try {
        const fleetContext = buildFleetContext(reportData);

        const systemPrompt = `You are the Munandy Bakery AI Fleet Agent, an expert fleet manager and vehicle safety analyst for Munandy Bakery in Zimbabwe. 
Your job is to analyze the daily fleet inspection report and output ONLY a raw JSON object. Do not wrap the JSON in markdown blocks (e.g. no \`\`\`json).

The JSON must exactly match this structure:
{
  "pattern_alerts": [
    "Alert 1 (e.g. 'Two different drivers reported a radiator fault on AHF2297 today.')",
    "Alert 2"
  ],
  "escalation_sentence": "A single dynamically calibrated sentence reflecting the severity of today's faults (e.g. '⚠️ With 4 grounded vehicles and zero resolutions, immediate workshop intervention is critical today.')"
}

Rules:
- For \`pattern_alerts\`: look for correlations across the raw data. Did multiple drivers report faults on the same vehicle? Did the same fault appear across multiple vehicles? If no significant patterns exist, return an empty array []. Keep them concise.
- For \`escalation_sentence\`: Look at the total counts of critical faults, recurring faults, and resolved issues, and generate one punchy management-level summary sentence. Prefix it with an appropriate emoji.
- Do NOT output any text outside of the raw JSON object.`;

        const userPrompt = `Analyze today's fleet data and provide your JSON response:\n\n${fleetContext}`;

        console.log(`[${new Date().toISOString()}] 🤖 Calling Claude AI for structured fleet analysis...`);

        const message = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 400,
            temperature: 0.2,
            messages: [
                { role: 'user', content: userPrompt }
            ],
            system: systemPrompt,
        });

        let analysisText = message.content?.[0]?.text?.trim();

        if (!analysisText) {
            throw new Error('Claude returned an empty response.');
        }

        // Clean up markdown wrapping if Claude disobeys
        if (analysisText.startsWith('```json')) {
            analysisText = analysisText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (analysisText.startsWith('```')) {
            analysisText = analysisText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const parsedAnalysis = JSON.parse(analysisText);
        console.log(`[${new Date().toISOString()}] ✅ Claude AI structured analysis received successfully.`);
        return parsedAnalysis;

    } catch (err) {
        console.error(`[${new Date().toISOString()}] ❌ Claude AI structured analysis failed: ${err.message}. Falling back to rule-based.`);
        
        // Fallback structure
        const streaks = reportData.streaks || [];
        const resolved = reportData.resolved || [];
        const criticalFaultsCount = reportData.faults ? reportData.faults.filter(f => [
            "Is the car running?", "Brake Fluid", "Brake Lights", "Oil", "Leaks (Oil, Radiator, diesel, pipes)", "Tyre Pressure"
        ].includes(f.item)).length : 0;

        let escalation = `⚠️ ${streaks.length} recurring faults and ${resolved.length} resolved today.`;
        if (criticalFaultsCount > 0) escalation = `🚨 ${criticalFaultsCount} critical faults reported today. Supervisor intervention required.`;
        
        return {
            pattern_alerts: [],
            escalation_sentence: escalation
        };
    }
}

module.exports = { getClaudeAnalysis };
