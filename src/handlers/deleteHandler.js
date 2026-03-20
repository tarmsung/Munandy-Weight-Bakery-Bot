const { getTodayRecords, deleteRecord } = require('../db/records');
const { getSupervisorBranch } = require('../db/supervisors');
const { getSession, setSession, clearSession } = require('../sessions/sessionManager');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

/** Start a /delete session — list today's records for the branch. */
async function startDelete(sock, jid, senderNumber) {
    const branch = await getSupervisorBranch(senderNumber) || 'Admin';

    let records = [];
    try {
        const todayRecords = await getTodayRecords();
        records = todayRecords.filter(r => r.branch === branch);
    } catch (err) {
        console.error('Error fetching records for delete:', err);
        await sock.sendMessage(jid, { text: `❌ Could not fetch today's records. Please try again.` });
        return;
    }

    if (records.length === 0) {
        await sock.sendMessage(jid, { text: `📭 No records found for *${branch}* today. Nothing to delete.` });
        return;
    }

    let menu = `🗑️ *Today's Records for ${branch}:*\n\n`;
    records.forEach((r, i) => {
        const finishLabel = r.finish_type ? ` (${r.finish_type})` : '';
        const quantityLabel = r.quantity ? ` — ${r.quantity} units` : '';
        menu += `${NUMBER_EMOJIS[i] || `${i + 1}.`} *${r.product_name}*${finishLabel}${quantityLabel}\n`;
        menu += `   Avg: ${Math.round(r.average)}g | Status: ${r.status}\n\n`;
    });

    menu += `Enter the *number(s)* of the record(s) to delete, separated by commas.\n`;
    menu += `Example: _1, 3_\n\n`;
    menu += `Or type *all* to delete all records today.`;

    setSession(jid, { step: 'DELETE_SELECT', senderNumber, branch, records });
    await sock.sendMessage(jid, { text: menu });
}

/**
 * Handle steps of an active delete session.
 * Returns true if the message was consumed, false otherwise.
 */
async function handleDeleteStep(sock, msg, text, jid) {
    const session = getSession(jid);
    if (!session || !session.step?.startsWith('DELETE_')) return false;

    const reply = (message) =>
        sock.sendMessage(jid, { text: message }, { quoted: msg });

    const input = text.trim();

    switch (session.step) {
        case 'DELETE_SELECT': {
            const { records } = session;

            // Delete ALL
            if (input.toLowerCase() === 'all') {
                setSession(jid, { ...session, step: 'DELETE_CONFIRM_ALL' });
                await reply(
                    `⚠️ *Are you sure you want to delete ALL ${records.length} record(s) for ${session.branch} today?*\n\n` +
                    `Reply *yes* to confirm or *no* to cancel.`
                );
                return true;
            }

            // Parse comma-separated numbers
            const parts = input.split(',').map(s => parseInt(s.trim(), 10));
            const invalid = parts.filter(n => isNaN(n) || n < 1 || n > records.length);

            if (invalid.length > 0) {
                await reply(
                    `❌ Invalid selection: *${invalid.join(', ')}*.\n` +
                    `Please enter numbers between 1 and ${records.length}, separated by commas, or type *all*.`
                );
                return true;
            }

            // Unique selections
            const unique = [...new Set(parts)];
            const selectedRecords = unique.map(n => records[n - 1]);

            // Build confirmation message
            let confirmMsg = `⚠️ *You are about to delete the following record(s):*\n\n`;
            selectedRecords.forEach(r => {
                const finishLabel = r.finish_type ? ` (${r.finish_type})` : '';
                confirmMsg += `• *${r.product_name}*${finishLabel}\n`;
            });
            confirmMsg += `\nReply *yes* to confirm or *no* to cancel.`;

            setSession(jid, { ...session, step: 'DELETE_CONFIRM', selectedRecords });
            await reply(confirmMsg);
            return true;
        }

        case 'DELETE_CONFIRM': {
            if (input.toLowerCase() === 'yes') {
                const { selectedRecords } = session;
                let deletedCount = 0;
                for (const record of selectedRecords) {
                    try {
                        await deleteRecord(record.id);
                        deletedCount++;
                    } catch (err) {
                        console.error(`Failed to delete record ${record.id}:`, err.message);
                    }
                }
                clearSession(jid);
                await reply(
                    `✅ *Done! ${deletedCount} record(s) deleted for ${session.branch} today.*\n\n` +
                    `Type *delete* to delete more, or *weigh* to start a new session.`
                );
            } else if (input.toLowerCase() === 'no') {
                clearSession(jid);
                await reply(`↩️ Cancelled. No records were deleted.`);
            } else {
                await reply(`❌ Please reply *yes* to confirm deletion or *no* to cancel.`);
            }
            return true;
        }

        case 'DELETE_CONFIRM_ALL': {
            if (input.toLowerCase() === 'yes') {
                const { records } = session;
                let deletedCount = 0;
                for (const record of records) {
                    try {
                        await deleteRecord(record.id);
                        deletedCount++;
                    } catch (err) {
                        console.error(`Failed to delete record ${record.id}:`, err.message);
                    }
                }
                clearSession(jid);
                await reply(
                    `✅ *Done! All ${deletedCount} record(s) for ${session.branch} today have been deleted.*\n\n` +
                    `Type *weigh* to start a new session.`
                );
            } else if (input.toLowerCase() === 'no') {
                clearSession(jid);
                await reply(`↩️ Cancelled. No records were deleted.`);
            } else {
                await reply(`❌ Please reply *yes* to confirm or *no* to cancel.`);
            }
            return true;
        }

        default:
            return false;
    }
}

module.exports = { startDelete, handleDeleteStep };
