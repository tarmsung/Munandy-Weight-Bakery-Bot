const nodeHtmlToImage = require('node-html-to-image');

// Map DB branch full names → display names and colours
const BRANCH_META = {
    'Harare':   { name: 'Harare',   color: '#1a6b5a', light: '#e8f5f1' },
    'Mutare':   { name: 'Mutare',   color: '#1a3f6b', light: '#e8eff8' },
    'Bulawayo': { name: 'Bulawayo', color: '#4a1a6b', light: '#f3e8f8' },
};

// Preferred display order (matches DB full branch names)
const BRANCH_ORDER = ['Harare', 'Mutare', 'Bulawayo'];

function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? 0 : num;
}

/**
 * Group and sum job cards by branch → vehicle.
 * Returns: { branchCode: { vehicles: [{reg, total, cards}], branchTotal } }
 */
function groupJobCards(jobCards) {
    const grouped = {};

    for (const jc of jobCards) {
        const branchCode = jc.branch || 'UNKNOWN';
        const reg = jc.vehicle_registration || 'Unknown';
        const price = parsePrice(jc.price);

        if (!grouped[branchCode]) {
            grouped[branchCode] = { vehicles: {}, branchTotal: 0 };
        }
        if (!grouped[branchCode].vehicles[reg]) {
            grouped[branchCode].vehicles[reg] = { total: 0, cards: [] };
        }
        grouped[branchCode].vehicles[reg].total += price;
        grouped[branchCode].vehicles[reg].cards.push(jc);
        grouped[branchCode].branchTotal += price;
    }

    // Convert vehicles map → sorted array
    for (const code of Object.keys(grouped)) {
        grouped[code].vehicles = Object.entries(grouped[code].vehicles)
            .map(([reg, data]) => ({ reg, total: data.total, cards: data.cards }))
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
        
        let cardDetails = v.cards.map(c => `
            <div style="font-size:12px; margin-top: 6px; padding: 6px; border-left: 3px solid ${meta.color}; background: #f9f9f9; border-radius: 0 4px 4px 0;">
                <div style="font-weight: 600; color: #2c3e50; margin-bottom: 3px;">${c.description}</div>
                <div style="color: #7f8c8d;">
                    <b>Date:</b> ${c.job_date || 'N/A'} &bull; 
                    <b>Driver ID:</b> ${c.driver_job_id} &bull; 
                    <b>Fuel:</b> ${c.fuel || 'N/A'}<br/>
                    <b>Time Out:</b> ${c.time_out || 'N/A'} &bull; 
                    <b>Time In:</b> ${c.time_in || 'N/A'} &bull; 
                    <b>Price:</b> <span style="color:#27ae60;font-weight:bold;">$${parsePrice(c.price).toFixed(2)}</span>
                </div>
            </div>
        `).join('');

        return (
            '<tr style="background:' + bg + '">' +
            '<td style="padding:11px 18px;font-size:14px;color:#2d3436;">' +
            '    <div style="font-weight: 700; font-size: 15px;">' + v.reg + '</div>' + 
                 cardDetails + 
            '</td>' +
            '<td style="padding:11px 18px;font-size:14px;font-weight:bold;color:#c0392b;text-align:right;vertical-align:top;">$' + v.total.toFixed(2) + '</td>' +
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
        '<span style="color:#ecf0f1;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Vehicle & Job Cards</span>' +
        '<span style="color:#ecf0f1;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Total Price</span>' +
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
 * Generate a PNG image report for Job Cards — grouped by branch.
 */
async function generateJobCardImageReport(jobCards, startDateStr, endDateStr, totalAmount, branchName = 'All Branches') {

    const grouped = groupJobCards(jobCards);

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
    <div style="background:#2c3e50;color:white;padding:22px 28px;border-radius:12px 12px 0 0;text-align:center;">
        <div style="font-size:26px;font-weight:800;letter-spacing:1px;">Munandy Transport</div>
        <div style="font-size:14px;opacity:0.85;margin-top:5px;">
            Job Cards Report &bull; ${branchName} &bull; ${startDateStr} to ${endDateStr}
        </div>
    </div>

    <!-- Grand Total Banner -->
    <div style="background:white;border-left:5px solid #27ae60;border-right:5px solid #27ae60;padding:18px 28px;text-align:center;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="font-size:12px;color:#7f8c8d;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Grand Total — All Job Cards</div>
        <div style="font-size:32px;font-weight:900;color:#27ae60;">$${totalAmount.toFixed(2)}</div>
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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        },
    });
}

module.exports = { generateJobCardImageReport, parsePrice };
