const { getTodayRecords } = require('../db/records');

function statusEmoji(status) {
    return status === 'Optimal' ? '✅' : status === 'Overweight' ? '🔴' : '🔵';
}

async function handleToday(sock, jid, msg) {
    const records = await getTodayRecords();

    if (records.length === 0) {
        await sock.sendMessage(
            jid,
            { text: `📭 *No records for today yet.*\n\nType /weigh to start recording.` },
            { quoted: msg }
        );
        return;
    }

    const today = new Date().toLocaleDateString('en-ZA', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const optimal = records.filter((r) => r.status === 'Optimal').length;
    const over = records.filter((r) => r.status === 'Overweight').length;
    const under = records.filter((r) => r.status === 'Underweight').length;

    let msg_text = `📊 *Today's Production Summary*\n_${today}_\n\n`;
    msg_text += `✅ Optimal: *${optimal}*  |  🔴 Over: *${over}*  |  🔵 Under: *${under}*\n`;
    msg_text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    for (const r of records) {
        const avg = Math.round(r.average);
        const variance = r.variance > 0 ? `+${r.variance}g` : r.variance < 0 ? `${r.variance}g` : `0g (within range)`;
        msg_text +=
            `${statusEmoji(r.status)} *${r.product_name}*\n` +
            `   Avg: ${avg}g  |  Target: ${r.min_weight}g–${r.max_weight}g  |  Variance: ${variance}\n`;
    }

    msg_text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg_text += `_${records.length} batch${records.length !== 1 ? 'es' : ''} recorded today_`;

    await sock.sendMessage(jid, { text: msg_text }, { quoted: msg });
}

module.exports = { handleToday };
