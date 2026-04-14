const fs = require('fs');
const nodeHtmlToImage = require('node-html-to-image');

// Mock data
const sessionData = {
    driverName: 'John Doe',
    vehicleRoutes: [
        {
            make: 'Mercedes Benz',
            nickname: 'Yellow Container',
            registration: 'AFT4319',
            branch: 'Harare',
            routes: [
                { name: 'Mutare Road', distance_km: 15 },
                { name: 'CBD Loop', distance_km: 8 }
            ],
            reported_distance_km: 23
        },
        {
            make: 'Toyota Dyna',
            nickname: 'Blue Truck',
            registration: 'BGE1022',
            branch: 'Bulawayo',
            routes: [],
            reported_distance_km: 0
        }
    ],
    isEdited: false
};

// Simplified HTML generation from src/vehicle/routeReport.js
function buildRouteReportHTML(sessionData) {
    const { driverName, vehicleRoutes, isEdited } = sessionData;
    const dateStr = new Date().toLocaleString('en-US', { timeZoneName: 'short' });

    const editBanner = isEdited ? `<div class="edit-banner">⚠️ CORRECTED REPORT</div>` : '';
    
    let vehicleCardsHtml = '';
    vehicleRoutes.forEach(entry => {
        const { make, nickname, registration, branch, routes, reported_distance_km } = entry;
        
        let routesHtml = '';
        if (routes.length === 0) {
            routesHtml = '<div class="no-routes">No route reported</div>';
        } else {
            routes.forEach(r => {
                const distAttr = r.distance_km != null ? ` (${r.distance_km} km)` : '';
                routesHtml += `<span class="route-badge">${r.name}${distAttr}</span>`;
            });
        }

        vehicleCardsHtml += `
        <div class="vehicle-card">
            <div class="vehicle-header">
                <span class="vehicle-name">${make} ${nickname}</span>
                <span class="vehicle-reg">${registration} — ${branch}</span>
            </div>
            <div class="distance-row">
                <span class="label">Total Distance:</span>
                <span class="value">${reported_distance_km} km</span>
            </div>
            <div class="routes-container">
                ${routesHtml}
            </div>
        </div>
        `;
    });

    return `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; background-color: #f0f2f5; padding: 20px; width: 600px; }
          .report-container { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
          .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #007bff; text-transform: uppercase; }
          .meta-info { display: flex; justify-content: space-between; background: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 20px; }
          .vehicle-card { border: 1px solid #e4e6eb; border-radius: 6px; margin-bottom: 15px; overflow: hidden; }
          .vehicle-header { background: #007bff; color: white; padding: 8px 12px; display: flex; justify-content: space-between; }
          .distance-row { padding: 10px; border-bottom: 1px dashed #e4e6eb; }
          .routes-container { padding: 10px; display: flex; flex-wrap: wrap; gap: 5px; }
          .route-badge { background: #e7f3ff; color: #007bff; padding: 4px 8px; border-radius: 12px; font-size: 0.8em; border: 1px solid #cce4ff; }
          .no-routes { color: #888; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="report-container">
          ${editBanner}
          <div class="header"><h1>Route Report</h1></div>
          <div class="meta-info">
            <div><strong>Reporter:</strong> ${driverName}</div>
            <div><strong>Date:</strong> ${dateStr}</div>
          </div>
          ${vehicleCardsHtml}
        </div>
      </body>
    </html>`;
}

const html = buildRouteReportHTML(sessionData);

nodeHtmlToImage({
    html: html,
    quality: 100,
    type: 'jpeg',
    puppeteerArgs: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
}).then((image) => {
    fs.writeFileSync('report_preview.jpg', image);
    console.log('Preview generated: report_preview.jpg');
    process.exit(0);
}).catch(err => {
    console.error('Failed to generate preview:', err);
    process.exit(1);
});
