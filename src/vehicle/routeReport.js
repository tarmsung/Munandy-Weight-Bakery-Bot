require('dotenv').config();
const nodeHtmlToImage = require('node-html-to-image');
const { getSocket } = require('../state');

/**
 * Builds the HTML template for the Route Report.
 */
function buildRouteReportHTML(sessionData) {
    const { driverName, vehicleRoutes, isEdited } = sessionData;
    const dateStr = new Date().toLocaleString('en-GB', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });

    const editBanner = isEdited ? `<div class="edit-banner">⚠️ CORRECTED REPORT</div>` : '';
    
    let tableRows = '';
    vehicleRoutes.forEach(entry => {
        const { make, nickname, registration, branch, routes, reported_distance_km } = entry;
        
        let routesList = '';
        if (routes.length === 0) {
            routesList = '<span class="no-route">None</span>';
        } else {
            routesList = routes.map(r => {
                const dist = r.distance_km != null ? ` (${r.distance_km}km)` : '';
                return `<div class="route-item">${r.id}. ${r.name}${dist}</div>`;
            }).join('');
        }

        tableRows += `
        <tr>
            <td>
                <strong>${make} ${nickname}</strong><br>
                <small>${registration} (${branch})</small>
            </td>
            <td>${routesList}</td>
            <td class="dist-cell">${reported_distance_km} km</td>
        </tr>
        `;
    });

    return `
    <html>
      <head>
        <style>
          body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            background-color: #fff;
            margin: 0;
            padding: 20px;
            width: 850px;
          }
          .report-header {
            border-bottom: 2px solid #2c3e50;
            margin-bottom: 20px;
            padding-bottom: 10px;
          }
          .report-header h1 {
            color: #2c3e50;
            margin: 0;
            font-size: 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .edit-banner {
            background: #fff3cd;
            color: #856404;
            padding: 8px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #ffeeba;
            border-radius: 4px;
            margin-bottom: 15px;
          }
          .meta-bar {
            background: #f8f9fa;
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            font-size: 14px;
            color: #555;
            display: flex;
            justify-content: space-between;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }
          th {
            background-color: #2c3e50;
            color: white;
            text-align: left;
            padding: 12px 10px;
          }
          td {
            border-bottom: 1px solid #eee;
            padding: 12px 10px;
            vertical-align: top;
          }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .route-item {
            font-size: 13px;
            margin-bottom: 2px;
          }
          .no-route { color: #999; font-style: italic; }
          .dist-cell { font-weight: bold; color: #27ae60; font-size: 16px; }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 12px;
            color: #7f8c8d;
            border-top: 1px solid #eee;
            padding-top: 10px;
          }
        </style>
      </head>
      <body>
        ${editBanner}
        <div class="report-header">
            <h1>Route Summary Report</h1>
        </div>
        
        <div class="meta-bar">
          <span><strong>Reporter:</strong> ${driverName}</span>
          <span><strong>Date:</strong> ${dateStr}</span>
        </div>

        <table>
            <thead>
                <tr>
                    <th width="35%">Vehicle</th>
                    <th width="45%">Routes Taken</th>
                    <th width="20%">Distance</th>
                </tr>
            </thead>
            <tbody>
                ${tableRows}
            </tbody>
        </table>

        <div class="footer">
            Munandy Vehicle Management System • Auto-generated
        </div>
      </body>
    </html>
    `;
}

/**
 * Build and send the formatted Route Report to the WhatsApp group as an IMAGE.
 */
async function sendRouteReportToGroup(sock, sessionData) {
    const notifyJid = process.env.NOTIFY_GROUP_JID;
    if (!notifyJid) {
        console.warn('NOTIFY_GROUP_JID not set — skipping group notification.');
        return;
    }

    const htmlContent = buildRouteReportHTML(sessionData);

    try {
        console.log('[DEBUG] Generating route report (Table View)...');
        const imageBuffer = await nodeHtmlToImage({
            html: htmlContent,
            quality: 100,
            type: 'jpeg',
            puppeteerArgs: {
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
            }
        });

        console.log('Sending route report image to group...');
        await getSocket().sendMessage(notifyJid, { 
            image: imageBuffer,
            caption: `🗺️ Route Report submitted by ${sessionData.driverName}`
        });
        console.log('Route report image sent to group successfully.');
    } catch (err) {
        console.error('Failed to send route report image to group:', err);
        
        // Fallback to text if image fails
        const fallbackText = `🗺️ Route Report\nReporter: ${sessionData.driverName}\nDate: ${new Date().toLocaleString()}\n(Image generation failed: ${err.message})`;
        try {
            await getSocket().sendMessage(notifyJid, { text: fallbackText });
        } catch (e) { console.error('Secondary error:', e.message); }
    }
}

module.exports = { sendRouteReportToGroup };
