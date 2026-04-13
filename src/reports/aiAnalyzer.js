const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Generate an AI summary based on the daily weight records via Claude.
 * @param {Array} records 
 * @returns {Promise<string|null>}
 */
async function generateAIAnalysis(records) {
    if (!records || records.length === 0) return null;
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠️  ANTHROPIC_API_KEY not set — skipping AI analysis.');
        return null;
    }

    try {
        // Prepare the data snippet for the AI
        const dataSnippet = records.map(r =>
            `Product: ${r.product_name}, Avg: ${Math.round(r.average)}g, Variance: ${r.variance}g, Status: ${r.status}`
        ).join('\n');

        const systemPrompt = `You are the Quality Control Manager at Munandy Bakery. Review today's batch weight records and provide a 2-3 sentence extremely concise summary for the owners.
Highlight any positive consistency, or flag concerning variance trends (e.g. repeated overweight or underweight batches).
Do NOT use markdown bolding or headers. Plain text only.`;

        const userPrompt = `Data:\n${dataSnippet}`;

        const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 200,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        });

        return response.content?.[0]?.text?.trim() || null;
    } catch (err) {
        console.error('❌ AI Quality Analysis failed:', err.message);
        return null; // Gracefully fallback if Claude fails
    }
}

module.exports = { generateAIAnalysis };
