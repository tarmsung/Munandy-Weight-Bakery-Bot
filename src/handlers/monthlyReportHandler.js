const { getReportsByMonth } = require('../db/supervisorReports');

const AREAS = [
    'delivery', 'procurement', 'production', 'workers', 
    'cashing_office', 'security', 'packing', 'hygiene'
];

// Area mapping for display labels
const AREA_LABELS = {
    'delivery': 'Delivery',
    'procurement': 'Procurement',
    'production': 'Production',
    'workers': 'Workers',
    'cashing_office': 'Cashing Office',
    'security': 'Security',
    'packing': 'Packing',
    'hygiene': 'Hygiene'
};

async function generateMonthlySupervisorReport(year, month) {
    const reports = await getReportsByMonth(year, month);
    
    const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
    
    if (reports.length === 0) {
        return `📭 *Monthly Operations Analysis Report*\n_${monthName} ${year}_\n\nNo supervisor reports found for this month.`;
    }

    // Days in the month to calculate "Daily Reports Submitted"
    const daysInMonth = new Date(year, month, 0).getDate();

    const branchStats = {};
    
    // Initialize stats
    reports.forEach(r => {
        if (!branchStats[r.branch]) {
            branchStats[r.branch] = {
                reportsCount: 0,
                majorIncidents: 0,
                areaScores: {},
                issues: {} // tracking issues per area
            };
            AREAS.forEach(area => {
                branchStats[r.branch].areaScores[area] = { sum: 0, count: 0 };
            });
        }
    });

    // Accumulate scores
    reports.forEach(r => {
        branchStats[r.branch].reportsCount++;

        AREAS.forEach(area => {
            const scoreKey = `${area}_score`;
            const score = r[scoreKey];
            if (score) {
                branchStats[r.branch].areaScores[area].sum += score;
                branchStats[r.branch].areaScores[area].count++;
                
                // Count major incidents (score 1 or 2)
                if (score <= 2) {
                    branchStats[r.branch].majorIncidents++;
                    branchStats[r.branch].issues[area] = (branchStats[r.branch].issues[area] || 0) + 1;
                }
            }
        });
    });

    const branchNames = Object.keys(branchStats).sort();
    
    // Calculate final scores
    for (const branch of branchNames) {
        let totalScoreSum = 0;
        let totalScoreCount = 0;
        
        AREAS.forEach(area => {
            const stat = branchStats[branch].areaScores[area];
            if (stat.count > 0) {
                // Percentage for the area
                stat.percentage = Math.round((stat.sum / (stat.count * 5)) * 100);
                totalScoreSum += stat.sum;
                totalScoreCount += stat.count;
            } else {
                stat.percentage = 0;
            }
        });
        
        branchStats[branch].overallPercentage = totalScoreCount > 0 ? Math.round((totalScoreSum / (totalScoreCount * 5)) * 100) : 0;
    }

    // Build the Markdown Report
    let report = `📊 *MONTHLY OPERATIONS ANALYSIS REPORT*\n\n`;
    report += `*Month:* ${monthName} ${year}\n`;
    report += `*Shops Analyzed:* ${branchNames.join(' | ')}\n\n`;
    report += `---\n\n`;

    // 1. Executive Summary
    report += `*1. Executive Summary*\n\n`;
    for (const branch of branchNames) {
        const stat = branchStats[branch];
        report += `🏢 *${branch}*\n`;
        report += `- Reports: ${stat.reportsCount}/${daysInMonth}\n`;
        report += `- Operational Score: ${stat.overallPercentage}%\n`;
        report += `- Major Incidents: ${stat.majorIncidents}\n`;
        report += `- Hygiene Compliance: ${stat.areaScores['hygiene'].percentage}%\n`;
        report += `- Delivery Performance: ${stat.areaScores['delivery'].percentage}%\n\n`;
    }
    report += `---\n\n`;

    // 2. Department Performance Comparison
    report += `*2. Department Performance Comparison*\n\n`;
    AREAS.forEach(area => {
        let bestBranch = null;
        let bestScore = -1;
        let lowestBranch = null;
        let lowestScore = 101;

        branchNames.forEach(branch => {
            const score = branchStats[branch].areaScores[area].percentage;
            if (score > bestScore) { bestScore = score; bestBranch = branch; }
            if (score < lowestScore) { lowestScore = score; lowestBranch = branch; }
        });

        report += `*${AREA_LABELS[area]}*\n`;
        report += `🥇 Best: ${bestBranch} (${bestScore}%)\n`;
        report += `📉 Lowest: ${lowestBranch} (${lowestScore}%)\n\n`;
    });
    report += `---\n\n`;

    // 3. Monthly Rankings
    report += `*3. Monthly Rankings*\n\n`;
    const rankings = branchNames.map(b => ({ name: b, score: branchStats[b].overallPercentage }))
        .sort((a, b) => b.score - a.score);

    const medals = ['🥇', '🥈', '🥉'];
    rankings.forEach((r, idx) => {
        const medal = medals[idx] || `${idx + 1}th`;
        report += `${medal} *${r.name}* (${r.score}%)\n`;
    });

    return report;
}

module.exports = {
    generateMonthlySupervisorReport
};
