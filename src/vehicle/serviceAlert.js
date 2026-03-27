const nodeHtmlToImage = require('node-html-to-image');
const { SERVICE_INTERVAL_KM } = require('../db/service');

/**
 * Builds the HTML for the service alert image.
 */
function buildServiceAlertHTML(alertVehicles, dateLabel) {
    const rows = alertVehicles.map(v => {
        const km = Math.round(v.km_since_service);
        const isOverdue = v.status === 'OVERDUE';
        const kmText = isOverdue
            ? `<span class="overdue-text">OVERDUE by ${km - SERVICE_INTERVAL_KM} km</span>`
            : `<span class="due-soon-text">${SERVICE_INTERVAL_KM - km} km remaining</span>`;
        const badge = isOverdue
            ? `<span class="badge overdue">🔴 OVERDUE</span>`
            : `<span class="badge due-soon">⚠️ DUE SOON</span>`;
        const label = v.nickname ? `${v.make} ${v.nickname}` : v.make;

        return `
        <div class="vehicle-row">
            <div class="vehicle-name">${label} <span class="reg">(${v.registration})</span></div>
            <div class="km-info">Km since last service: <strong>${km.toLocaleString()} km</strong></div>
            <div class="km-info">${kmText}</div>
            <div class="badge-row">${badge}</div>
        </div>`;
    }).join('<hr class="divider">');

    return `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Arial', sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            padding: 24px;
            width: 480px;
        }
        .header {
            background: linear-gradient(135deg, #e94560, #0f3460);
            border-radius: 12px;
            padding: 18px 20px;
            margin-bottom: 20px;
            text-align: center;
        }
        .header h1 {
            font-size: 22px;
            color: #fff;
            font-weight: bold;
        }
        .header .date {
            font-size: 13px;
            color: #ffd700;
            margin-top: 4px;
        }
        .vehicle-row {
            background: #16213e;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 4px;
        }
        .vehicle-name {
            font-size: 16px;
            font-weight: bold;
            color: #fff;
            margin-bottom: 6px;
        }
        .reg {
            font-size: 13px;
            color: #a0aec0;
            font-weight: normal;
        }
        .km-info {
            font-size: 13px;
            color: #cbd5e0;
            margin-bottom: 4px;
        }
        .overdue-text { color: #fc8181; font-weight: bold; }
        .due-soon-text { color: #fbd38d; font-weight: bold; }
        .badge-row { margin-top: 8px; }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: bold;
        }
        .badge.overdue   { background: #742a2a; color: #fc8181; }
        .badge.due-soon  { background: #744210; color: #fbd38d; }
        .divider {
            border: none;
            border-top: 1px solid #2d3748;
            margin: 8px 0;
        }
        .footer {
            text-align: center;
            font-size: 11px;
            color: #718096;
            margin-top: 16px;
        }
    </style>
    </head>
    <body>
        <div class="header">
            <h1>🔧 Service Due Alert</h1>
            <div class="date">${dateLabel}</div>
        </div>
        ${rows}
        <div class="footer">Munandy Fleet Management Bot · Auto-generated alert</div>
    </body>
    </html>`;
}

/**
 * Generates a service alert image and sends it to the notify group.
 * @param {Object} sock - Baileys socket
 * @param {Array} alertVehicles - Vehicles needing service alerts
 */
async function sendServiceAlertImage(sock, alertVehicles) {
    if (!alertVehicles || alertVehicles.length === 0) return;

    const notifyJid = process.env.NOTIFY_GROUP_JID;
    if (!notifyJid) {
        console.warn('[Service Alert] NOTIFY_GROUP_JID not set. Skipping alert.');
        return;
    }

    const dateLabel = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const html = buildServiceAlertHTML(alertVehicles, dateLabel);

    try {
        console.log('[Service Alert] Generating service alert image...');
        const imageBuffer = await nodeHtmlToImage({
            html,
            quality: 100,
            type: 'jpeg',
            puppeteerArgs: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
        });

        await sock.sendMessage(notifyJid, {
            image: imageBuffer,
            caption: `🔧 Service Due Alert — ${alertVehicles.length} vehicle(s) require attention.`
        });
        console.log('[Service Alert] ✅ Alert image sent to group.');
    } catch (err) {
        console.error('[Service Alert] ❌ Image generation failed, sending text fallback:', err.message);
        // Text fallback
        let fallback = `🔧 *Service Due Alert — ${dateLabel}*\n\n`;
        alertVehicles.forEach(v => {
            const km = Math.round(v.km_since_service);
            const isOverdue = v.status === 'OVERDUE';
            const name = v.nickname ? `${v.make} ${v.nickname}` : v.make;
            fallback += `${isOverdue ? '🔴' : '⚠️'} *${name}* (${v.registration})\n`;
            fallback += `   Km since service: ${km.toLocaleString()} km\n`;
            if (isOverdue) {
                fallback += `   Status: OVERDUE by ${km - SERVICE_INTERVAL_KM} km\n\n`;
            } else {
                fallback += `   Status: DUE SOON — ${SERVICE_INTERVAL_KM - km} km remaining\n\n`;
            }
        });
        await sock.sendMessage(notifyJid, { text: fallback });
    }
}

module.exports = { sendServiceAlertImage };
