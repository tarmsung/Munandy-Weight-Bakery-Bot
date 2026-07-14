const nodeHtmlToImage = require('node-html-to-image');

// Map DB branch full names → display names and colours
const BRANCH_META = {
    'Harare':   { name: 'Harare',   color: '#1a6b5a', light: '#e8f5f1' },
    'Mutare':   { name: 'Mutare',   color: '#1a3f6b', light: '#e8eff8' },
    'Bulawayo': { name: 'Bulawayo', color: '#4a1a6b', light: '#f3e8f8' },
    // Legacy shortcode aliases stored in DB before normalisation
    'MH':       { name: 'Harare',   color: '#1a6b5a', light: '#e8f5f1' },
    'MM':       { name: 'Mutare',   color: '#1a3f6b', light: '#e8eff8' },
    'MB':       { name: 'Bulawayo', color: '#4a1a6b', light: '#f3e8f8' },
};

// Preferred display order (matches DB full branch names)
const BRANCH_ORDER = ['Harare', 'Mutare', 'Bulawayo'];

// Normalise legacy shortcodes → canonical branch name
const BRANCH_ALIAS = {
    'MH': 'Harare',
    'MM': 'Mutare',
    'MB': 'Bulawayo',
};

/**
 * Group and sum expenses by branch → vehicle.
 * Returns: { branchCode: { vehicles: [{reg, total}], branchTotal } }
 */
function groupExpenses(expenses) {
    const grouped = {};

    for (const exp of expenses) {
        const raw = exp.branch || 'UNKNOWN';
        // Resolve legacy shortcodes to their canonical branch name
        const branchCode = BRANCH_ALIAS[raw] || raw;
        const reg = exp.vehicle_registration || 'Unknown';
        const amount = Number(exp.amount) || 0;

        if (!grouped[branchCode]) {
            grouped[branchCode] = { vehicles: {}, branchTotal: 0 };
        }
        if (!grouped[branchCode].vehicles[reg]) {
            grouped[branchCode].vehicles[reg] = 0;
        }
        grouped[branchCode].vehicles[reg] += amount;
        grouped[branchCode].branchTotal += amount;
    }

    // Convert vehicles map → sorted array
    for (const code of Object.keys(grouped)) {
        grouped[code].vehicles = Object.entries(grouped[code].vehicles)
            .map(([reg, total]) => ({ reg, total }))
            .sort((a, b) => b.total - a.total); // Highest spender first
    }

    return grouped;
}

/**
 * Build the HTML for one branch section table.
 */
function buildBranchSection(branchCode, data) {
    const isUnknown = branchCode === 'UNKNOWN';
    const meta = BRANCH_META[branchCode] || {
        name: isUnknown ? 'Unverified Vehicles' : branchCode,
        color: '#636e72',
        light: '#f5f6fa'
    };

    const vehicleRows = data.vehicles.map((v, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : meta.light;
        return (
            '<tr style="background:' + bg + '">' +
            '<td style="padding:11px 18px;font-size:14px;color:#2d3436;">' + v.reg + '</td>' +
            '<td style="padding:11px 18px;font-size:14px;font-weight:bold;color:#c0392b;text-align:right;">$' + v.total.toFixed(2) + '</td>' +
            '</tr>'
        );
    }).join('');

    return (
        '<div style="margin-bottom:24px;border-radius:10px;overflow:hidden;box-shadow:0 3px 12px rgba(0,0,0,0.08);">' +

        // Branch header
        '<div style="background:' + meta.color + ';padding:13px 18px;display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="color:white;font-size:16px;font-weight:700;letter-spacing:0.5px;">🏢 ' + meta.name.toUpperCase() + ' BRANCH</span>' +
        '</div>' +

        // Column headers
        '<div style="display:flex;justify-content:space-between;background:#34495e;padding:9px 18px;">' +
        '<span style="color:#ecf0f1;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Vehicle</span>' +
        '<span style="color:#ecf0f1;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Total Expenses</span>' +
        '</div>' +

        // Vehicle rows
        '<table style="width:100%;border-collapse:collapse;">' +
        '<tbody>' + vehicleRows + '</tbody>' +
        '</table>' +

        // Branch total row
        '<div style="display:flex;justify-content:space-between;align-items:center;background:' + meta.color + ';padding:11px 18px;">' +
        '<span style="color:white;font-size:14px;font-weight:700;">' + meta.name + ' Total</span>' +
        '<span style="color:#f1c40f;font-size:16px;font-weight:800;">$' + data.branchTotal.toFixed(2) + '</span>' +
        '</div>' +

        '</div>'
    );
}

/**
 * Generate a PNG image report for vehicle expenses — grouped by branch.
 * @param {Array}  expenses      - rows from vehicle_expenses
 * @param {string} startDateStr  - display date (e.g. 01/05/2026)
 * @param {string} endDateStr    - display date (e.g. 31/05/2026)
 * @param {number} totalAmount   - grand total
 * @param {string} branchName    - 'All Branches' or specific branch name
 * @returns {Promise<Buffer>}
 */
async function generateExpenseImageReport(expenses, startDateStr, endDateStr, totalAmount, branchName = 'All Branches') {

    const grouped = groupExpenses(expenses);

    // Build sections in preferred order, then any unknown codes
    const orderedCodes = [
        ...BRANCH_ORDER.filter(c => grouped[c]),
        ...Object.keys(grouped).filter(c => !BRANCH_ORDER.includes(c))
    ];

    const branchSections = orderedCodes.map(code => buildBranchSection(code, grouped[code])).join('');

    const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            padding: 30px;
            background-color: #f0f2f5;
            color: #2d3436;
            width: 820px;
        }
    </style>
</head>
<body>

    <!-- Header -->
    <div style="background:#1a252f;color:white;padding:22px 28px;border-radius:12px 12px 0 0;text-align:center;">
        <div style="font-size:26px;font-weight:800;letter-spacing:1px;">Munandy Transport</div>
        <div style="font-size:14px;opacity:0.85;margin-top:5px;">
            Vehicle Expense Report &bull; ${branchName} &bull; ${startDateStr} to ${endDateStr}
        </div>
    </div>

    <!-- Grand Total Banner -->
    <div style="background:white;border-left:5px solid #e74c3c;border-right:5px solid #e74c3c;padding:18px 28px;text-align:center;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="font-size:12px;color:#7f8c8d;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Grand Total — All Expenses</div>
        <div style="font-size:32px;font-weight:900;color:#c0392b;">$${totalAmount.toFixed(2)}</div>
    </div>

    <!-- Branch Sections -->
    ${branchSections}

    <!-- Footer -->
    <div style="text-align:center;font-size:11px;color:#b2bec3;margin-top:10px;">
        Generated by Munandy Transport Bot &bull; ${new Date().toLocaleString('en-ZA')}
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

module.exports = { generateExpenseImageReport };
