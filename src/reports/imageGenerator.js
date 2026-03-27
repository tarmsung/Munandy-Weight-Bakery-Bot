const nodeHtmlToImage = require('node-html-to-image');

/**
 * Generate a PNG image report from weight records.
 * @param {Array}  records  - rows from weight_records joined with products
 * @param {string} dateLabel - human-friendly date string
 * @param {string} [aiAnalysis] - Optional concise AI summary paragraph
 * @param {number} [flourKg] - Optional total flour used weight
 * @returns {Promise<Buffer>}
 */
async function generateImageReport(records, dateLabel, aiAnalysis, flourKg = null) {
    const optimalCount = records.filter(r => r.status === 'Optimal').length;
    const overweightCount = records.filter(r => r.status === 'Overweight').length;
    const underweightCount = records.filter(r => r.status === 'Underweight').length;

    // Group by branch
    const grouped = {};
    for (const r of records) {
        const branch = r.branch || 'Unknown';
        if (!grouped[branch]) grouped[branch] = [];
        grouped[branch].push(r);
    }

    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 30px;
            background-color: #f8f9fa;
            color: #2d3436;
            width: 800px; /* Fixed width for consistent image rendering */
        }
        .header {
            background-color: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 12px 12px 0 0;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            letter-spacing: 1px;
        }
        .header p {
            margin: 5px 0 0;
            font-size: 16px;
            opacity: 0.9;
        }
        .summary-bar {
            background-color: #fff;
            padding: 20px;
            border-bottom: 2px solid #eee;
            display: flex;
            justify-content: space-around;
            text-align: center;
        }
        .summary-item {
            flex: 1;
        }
        .summary-label {
            font-size: 12px;
            color: #636e72;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .summary-value {
            font-size: 18px;
            font-weight: bold;
        }
        .flour-pill {
            background-color: #fef9e7;
            border: 1px solid #f9e79f;
            color: #7d6608;
            padding: 10px 20px;
            margin: 15px auto;
            border-radius: 50px;
            display: inline-block;
            font-weight: bold;
            font-size: 15px;
        }
        .ai-insight {
            background-color: #ebf5fb;
            border-left: 5px solid #2980b9;
            padding: 15px 20px;
            margin: 20px 0;
            font-style: italic;
            border-radius: 0 8px 8px 0;
        }
        .ai-title {
            font-weight: bold;
            color: #2980b9;
            font-style: normal;
            margin-bottom: 5px;
            display: block;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background-color: white;
            border-radius: 0 0 12px 12px;
            overflow: hidden;
            box-shadow: 0 4px 15px rgba(0,0,0,0.05);
        }
        th {
            background-color: #34495e;
            color: white;
            padding: 12px 8px;
            text-align: center;
            font-size: 13px;
        }
        th:first-child { text-align: left; padding-left: 15px; }
        td {
            padding: 10px 8px;
            border-bottom: 1px solid #edf2f7;
            text-align: center;
            font-size: 13px;
        }
        td:first-child { text-align: left; padding-left: 15px; font-weight: 500; }
        .branch-row {
            background-color: #ecf0f1;
            font-weight: bold;
            color: #2c3e50;
            text-align: left;
            padding: 8px 15px;
            font-size: 14px;
        }
        .status-optimal { color: #27ae60; font-weight: bold; }
        .status-overweight { color: #e74c3c; font-weight: bold; }
        .status-underweight { color: #2980b9; font-weight: bold; }
        .footer {
            margin-top: 25px;
            text-align: center;
            font-size: 11px;
            color: #bdc3c7;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Munandy Bakery</h1>
        <p>Quality Control Report • ${dateLabel}</p>
    </div>

    <div class="summary-bar">
        <div class="summary-item">
            <div class="summary-label">Batches</div>
            <div class="summary-value">${records.length}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">✅ Optimal</div>
            <div class="summary-value" style="color: #27ae60;">${optimalCount}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">🔼 Overweight</div>
            <div class="summary-value" style="color: #e74c3c;">${overweightCount}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label">🔽 Underweight</div>
            <div class="summary-value" style="color: #2980b9;">${underweightCount}</div>
        </div>
    </div>

    <div style="text-align: center;">
        ${flourKg ? `<div class="flour-pill">🌾 Flour Used Today: ${flourKg} kg</div>` : ''}
    </div>

    ${aiAnalysis ? `
    <div class="ai-insight">
        <span class="ai-title">🤖 AI Quality Insight</span>
        ${aiAnalysis}
    </div>` : ''}

    <table>
        <thead>
            <tr>
                <th style="width: 200px;">Product</th>
                <th>S1</th>
                <th>S2</th>
                <th>S3</th>
                <th>S4</th>
                <th>Avg</th>
                <th style="width: 100px;">Range</th>
                <th>Variance</th>
                <th>Qty</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            ${Object.entries(grouped).map(([branch, branchRecords]) => `
                <tr>
                    <td colspan="10" class="branch-row">🏢 ${branch.toUpperCase()}</td>
                </tr>
                ${branchRecords.map(r => {
                    const statusClass = r.status.toLowerCase();
                    const statusEmoji = r.status === 'Optimal' ? '✅' : r.status === 'Overweight' ? '🔼' : '🔽';
                    const varianceDisplay = r.variance >= 0 ? `+${r.variance}g` : `${r.variance}g`;
                    return `
                    <tr>
                        <td>${r.product_name}</td>
                        <td>${r.sample1}</td>
                        <td>${r.sample2}</td>
                        <td>${r.sample3}</td>
                        <td>${r.sample4}</td>
                        <td><b>${Math.round(r.average)}g</b></td>
                        <td style="color: #7f8c8d; font-size: 11px;">${r.min_weight}-${r.max_weight}g</td>
                        <td>${varianceDisplay}</td>
                        <td>${r.quantity || '-'}</td>
                        <td class="status-${statusClass}">${statusEmoji} ${r.status}</td>
                    </tr>
                    `;
                }).join('')}
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        Generated by Munandy Weight Bot • ${new Date().toLocaleString('en-ZA')}
    </div>
</body>
</html>
    `;

    return await nodeHtmlToImage({
        html: htmlTemplate,
        quality: 100,
        type: 'png',
        puppeteerArgs: {
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
    });
}

module.exports = { generateImageReport };
