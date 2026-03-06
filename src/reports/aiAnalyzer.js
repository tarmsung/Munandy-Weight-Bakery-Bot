const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate an AI summary based on the daily weight records.
 * @param {Array} records 
 * @returns {Promise<string|null>}
 */
async function generateAIAnalysis(records) {
    if (!records || records.length === 0) return null;
    if (!process.env.OPENAI_API_KEY) {
        console.warn('⚠️  OPENAI_API_KEY not set — skipping AI analysis.');
        return null;
    }

    try {
        // Prepare the data snippet for the AI
        const dataSnippet = records.map(r =>
            `Product: ${r.product_name}, Avg: ${Math.round(r.average)}g, Variance: ${r.variance}g, Status: ${r.status}`
        ).join('\n');

        const prompt = `
You are the Quality Control Manager at Munandy Bakery. Review today's batch weight records and provide a 2-3 sentence extremely concise summary for the owners.
Highlight any positive consistency, or flag concerning variance trends (e.g. repeated overweight or underweight batches).

Data:
${dataSnippet}
`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (err) {
        console.error('❌ AI Analysis failed:', err.message);
        return null; // Gracefully fallback if OpenAI fails
    }
}

module.exports = { generateAIAnalysis };
