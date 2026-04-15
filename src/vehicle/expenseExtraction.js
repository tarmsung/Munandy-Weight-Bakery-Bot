const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Calls Claude AI to extract structured expense data from a raw message.
 * @param {string} rawMessage
 * @returns {Promise<{vehicle_registration: string, amount: number, description: string}|null>}
 */
async function extractExpenseData(rawMessage) {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn(`[${new Date().toISOString()}] ⚠️ ANTHROPIC_API_KEY not set. Cannot parse expense.`);
        return null;
    }

    try {
        const systemPrompt = `You are a data extraction assistant for Munandy Bakery's vehicle fleet.
Your job is to read a raw WhatsApp message about a vehicle expense and extract the exact details into JSON.

Rules:
1. Identify the vehicle registration or nickname (e.g. "ADH 4321", "White Sprinter", "ACH4184"). Return it exactly as it appears.
2. Identify the total monetary amount spent as a pure number. Ignore "$" or currency symbols in the input.
3. Identify the description or purpose of the expense (e.g. "bought new tyres", "tollgate").
4. Your response MUST be valid JSON only, with no markdown formatting, no backticks, and exactly these three keys:
   {
     "vehicle_registration": "string (or null if not found)",
     "amount": number (or null if not found),
     "description": "string (or null if not found)"
   }`;

        const userPrompt = `Extract the vehicle expense data from this message:\n\n"${rawMessage}"`;

        console.log(`[${new Date().toISOString()}] 🤖 Calling Claude AI to extract expense data...`);

        const message = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1024,
            temperature: 0,
            messages: [
                { role: 'user', content: userPrompt }
            ],
            system: systemPrompt,
        });

        let responseText = message.content?.[0]?.text?.trim() || '';
        console.log(`[Expense Extraction] Raw AI Response: ${responseText}`);
        
        // Robust JSON extraction: Find the first '{' and last '}'
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON object found in AI response');
        }

        const data = JSON.parse(jsonMatch[0]);

        // Validation
        if (!data.vehicle_registration || data.amount == null || !data.description) {
            console.warn(`[Expense Extraction] Incomplete data parsed:`, data);
            return null; // Don't try to log incomplete expenses
        }

        return data;

    } catch (err) {
        console.error(`[Expense Extraction] ❌ Failed to parse data via Claude: ${err.message}`);
        return null;
    }
}

module.exports = { extractExpenseData };
