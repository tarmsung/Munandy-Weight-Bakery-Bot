const Anthropic = require('@anthropic-ai/sdk');
const { getMonthlyExpenses, getMonthlyDistances } = require('../db/expenses');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Compiles distance and expense data for a given month and generates an AI analysis.
 * @param {number} month - 1-12
 * @param {number} year - e.g. 2026
 * @returns {Promise<string>}
 */
async function generateMonthlyViabilityReport(month, year) {
    console.log(`[Viability Report] Generating report for ${month}/${year}...`);

    try {
        const expenses = await getMonthlyExpenses(month, year);
        const distances = await getMonthlyDistances(month, year);

        // Combine data
        // We'll collect all vehicles that have either expenses or recorded distance
        const vehicles = new Set([...Object.keys(expenses), ...Object.keys(distances)]);
        const combinedData = [];

        let totalFleetExpense = 0;
        let totalFleetDistance = 0;

        for (const reg of vehicles) {
            const exp = expenses[reg] || 0;
            const dist = distances[reg] || 0;
            const costPerKm = dist > 0 ? (exp / dist).toFixed(2) : (exp > 0 ? 'Infinite' : 0);

            totalFleetExpense += exp;
            totalFleetDistance += dist;

            combinedData.push({
                registration: reg,
                expense: exp,
                distance: dist,
                costPerKm
            });
        }

        const fleetCostPerKm = totalFleetDistance > 0 ? (totalFleetExpense / totalFleetDistance).toFixed(2) : 0;

        if (combinedData.length === 0) {
            return `*Munandy Transport Monthly Viability Report (${month}/${year})*\n\nNo expense or route distance data recorded for this month.`;
        }

        // Build prompt context
        let context = `MUNANDY TRANSPORT FLEET - MONTHLY VIABILITY REPORT for ${month}/${year}\n`;
        context += `==========================================================\n\n`;
        context += `FLEET TOTALS:\n`;
        context += `- Total Expenses: $${totalFleetExpense}\n`;
        context += `- Total Distance: ${totalFleetDistance} km\n`;
        context += `- Fleet Cost per KM: $${fleetCostPerKm}/km\n\n`;

        context += `VEHICLE BREAKDOWN:\n`;
        combinedData.forEach(v => {
            context += `- ${v.registration}: Distance: ${v.distance} km | Expenses: $${v.expense} | Cost/KM: $${v.costPerKm}\n`;
        });

        // AI request
        const systemPrompt = `You are an expert financial and fleet analyst for Munandy Bakery, a transport company in Zimbabwe.
Your job is to analyze the monthly vehicle viability report based on expenses and distance travelled, and produce an executive summary.

Your response must:
- Highlight the most expensive vehicles to run (high Cost/KM).
- Highlight the most efficient vehicles.
- Determine if the fleet overall is operating at a healthy cost per km.
- Provide 2-3 specific management recommendations based on the data.
- Keep your tone professional, concise, and direct.
- Do NOT use heavy markdown formatting. Keep it readable for WhatsApp (you can use *, _ and lists).`;

        const userPrompt = `Please analyze the following fleet cost vs distance data and provide your viability analysis:\n\n${context}`;

        console.log(`[${new Date().toISOString()}] 🤖 Calling Claude AI for viability analysis...`);

        const message = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            temperature: 0.3,
            messages: [
                { role: 'user', content: userPrompt }
            ],
            system: systemPrompt,
        });

        const analysisText = message.content?.[0]?.text?.trim() || 'Analysis failed.';

        let finalReport = `📊 *Fleet Viability Report (${month}/${year})*\n\n`;
        finalReport += `_Data Summary:_\n`;
        finalReport += `Total Expenses: $${totalFleetExpense}\n`;
        finalReport += `Total Distance: ${totalFleetDistance} km\n`;
        finalReport += `Fleet Avg Cost/KM: $${fleetCostPerKm}\n\n`;
        finalReport += `*Executive Analysis:*\n${analysisText}`;

        return finalReport;

    } catch (err) {
        console.error(`[Viability Report] ❌ Failed to generate report: ${err.message}`);
        throw err;
    }
}

module.exports = { generateMonthlyViabilityReport };
