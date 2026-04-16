const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Aggregates monthly weight data and generates an AI analysis via Claude.
 * @param {Array} records 
 * @param {string} monthLabel 
 * @returns {Promise<Object>} - Contains analysis text and stats
 */
async function analyzeMonthlyWeights(records, monthLabel) {
    if (!records || records.length === 0) {
        return {
            analysis: "No data recorded for this month.",
            stats: {}
        };
    }

    // 1. Aggregate stats by branch
    const branchStats = {};
    const branches = ['Harare', 'Mutare', 'Bulawayo'];

    branches.forEach(b => {
        const branchRecords = records.filter(r => (r.branch || '').toLowerCase() === b.toLowerCase());
        if (branchRecords.length > 0) {
            const optimal = branchRecords.filter(r => r.status === 'Optimal').length;
            const overweight = branchRecords.filter(r => r.status === 'Overweight').length;
            const underweight = branchRecords.filter(r => r.status === 'Underweight').length;
            const total = branchRecords.length;

            branchStats[b] = {
                total,
                optimal,
                overweight,
                underweight,
                optimalPercent: ((optimal / total) * 100).toFixed(1),
                avgVariance: (branchRecords.reduce((sum, r) => sum + Math.abs(r.variance), 0) / total).toFixed(1)
            };
        }
    });

    // 2. Find best and worst performing branches
    let bestBranch = null;
    let worstBranch = null;
    let maxOptimal = -1;
    let minOptimal = 101;

    Object.entries(branchStats).forEach(([name, stats]) => {
        const optPercent = parseFloat(stats.optimalPercent);
        if (optPercent > maxOptimal) {
            maxOptimal = optPercent;
            bestBranch = name;
        }
        if (optPercent < minOptimal) {
            minOptimal = optPercent;
            worstBranch = name;
        }
    });

    // 3. Prepare data snippet for Claude
    let dataSnippet = `Monthly Weight Statistics for ${monthLabel}:\n\n`;
    Object.entries(branchStats).forEach(([name, stats]) => {
        dataSnippet += `${name} Branch:\n`;
        dataSnippet += `- Total Batches: ${stats.total}\n`;
        dataSnippet += `- Consistency (Optimal): ${stats.optimalPercent}%\n`;
        dataSnippet += `- Variance Issues: Overweight (${stats.overweight}), Underweight (${stats.underweight})\n`;
        dataSnippet += `- Avg absolute variance: ${stats.avgVariance}g\n\n`;
    });

    // 4. AI Prompt
    const systemPrompt = `You are the Lead Quality Control Auditor for Munandy Bakery. 
Analyze the monthly branch performance data provided and generate a comprehensive performance report.

Your report must include:
1. Performance Overview: A high-level summary of the month.
2. Best Performing Branch: Identify which branch performed best and why (based on % optimal and low variance).
3. Worst Performing Branch: Identify which branch had the most issues and the nature of those issues (e.g. consistently overweight).
4. Concerning Areas: Highlight specific trends or branches that need immediate attention.
5. Improvement Plan: 3-4 specific, actionable steps the branches should take to improve consistency.
6. Conclusion.

Format: Use professional, direct language. For the Improvement Plan section, start each recommendation with a hyphen (-) followed by a space. Do not use numbered lists. 
Prefix all main section headers with their number (e.g., "1. Performance Overview").
Keep the total length around 400-500 words. 
Do NOT use markdown symbols like *, **, #, or ---. Use plain text for section headers. Replace em-dashes (—) with standard punctuation like commas or parentheses.`;

    const userPrompt = `Data:\n${dataSnippet}`;

    try {
        console.log(`[Monthly Analyzer] 🤖 Calling Claude for ${monthLabel} analysis...`);
        const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1500,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        });

        const analysisText = response.content?.[0]?.text?.trim() || "Analysis generation failed.";

        return {
            analysis: analysisText,
            branchStats,
            bestBranch,
            worstBranch
        };
    } catch (err) {
        console.error('❌ Monthly AI Analysis failed:', err.message);
        return {
            analysis: "AI Analysis currently unavailable due to an error.",
            branchStats,
            bestBranch,
            worstBranch
        };
    }
}

module.exports = { analyzeMonthlyWeights };
