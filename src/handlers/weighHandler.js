const { getAllProducts } = require('../db/products');
const { saveRecord, deleteRecord, getTodayRecords } = require('../db/records');
const { getSupervisorBranch } = require('../db/supervisors');
const { saveFlourLog } = require('../db/flourLogs');
const { sendBranchReport } = require('../scheduler');
const { getSession, setSession, clearSession } = require('../sessions/sessionManager');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣'];

function statusEmoji(status) {
    return status === 'Optimal' ? '✅' : status === 'Overweight' ? '🔴' : '🔵';
}

function calcStatus(avg, min, max) {
    if (avg < min) return 'Underweight';
    if (avg > max) return 'Overweight';
    return 'Optimal';
}

/** Start a new /weigh session — fetch products and send menu. */
async function startWeigh(sock, jid, senderNumber) {
    const products = await getAllProducts();
    const branch = await getSupervisorBranch(senderNumber) || 'Admin';

    let menu = '📋 *Please select the product you are weighing:*\n\n';
    products.forEach((p, i) => {
        menu += `${NUMBER_EMOJIS[i]} ${p.product_name}\n`;
    });
    menu += '\nReply with the *number* of the product.';

    setSession(jid, { step: 'SELECT_PRODUCT', senderNumber, branch, products, samples: [] });
    await sock.sendMessage(jid, { text: menu });
}

/**
 * Handle each step of an active weigh session.
 * Returns true if the message was consumed by the session, false otherwise.
 */
async function handleWeighStep(sock, msg, text, jid) {
    const session = getSession(jid);
    if (!session) return false;

    const reply = (message) =>
        sock.sendMessage(jid, { text: message }, { quoted: msg });

    const input = text.trim();

    switch (session.step) {
        // ── Step 1: Worker picks product ─────────────────────────────────────────
        case 'SELECT_PRODUCT': {
            const num = parseInt(input, 10);
            if (isNaN(num) || num < 1 || num > session.products.length) {
                await reply(`❌ Please enter a number between 1 and ${session.products.length}.`);
                return true;
            }
            const product = session.products[num - 1];
            setSession(jid, { ...session, step: 'ENTER_SAMPLES', product });
            await reply(
                `✅ *Product selected: ${product.product_name}*\n\n` +
                `Enter all *4 sample weights* separated by commas.\n` +
                `Example: _341, 352, 348, 355_`
            );
            return true;
        }

        // ── Step 2: All four samples at once ─────────────────────────────────────
        case 'ENTER_SAMPLES': {
            // Parse comma-separated values and extract numbers
            const parts = input.split(',').map(s => parseFloat(s.trim()));

            if (parts.length !== 4 || parts.some(n => isNaN(n) || n <= 0)) {
                await reply(
                    `❌ Please enter exactly *4 valid weights* separated by commas.\n` +
                    `Example: _341, 352, 348, 355_`
                );
                return true;
            }

            const allSamples = parts;
            const avg = allSamples.reduce((a, b) => a + b, 0) / 4;
            const avgRounded = Math.round(avg);
            const { product } = session;
            const status = calcStatus(avg, product.min_weight, product.max_weight);

            // Variance = how far outside the range (0 if optimal)
            let variance = 0;
            if (status === 'Overweight') variance = parseFloat((avg - product.max_weight).toFixed(1));
            if (status === 'Underweight') variance = parseFloat((avg - product.min_weight).toFixed(1));
            const varianceStr = variance > 0 ? `+${variance}g` : variance < 0 ? `${variance}g` : `0g (within range)`;

            setSession(jid, { ...session, step: 'QUANTITY', samples: allSamples, average: avg, avgRounded, status, variance });

            await reply(
                `📊 *Calculation Result*\n\n` +
                `Product: *${product.product_name}*\n` +
                `Samples: ${allSamples.join(', ')}\n` +
                `Average: *${avgRounded}g*\n` +
                `Target:  ${product.min_weight}g – ${product.max_weight}g\n` +
                `Variance: *${varianceStr}*\n\n` +
                `Status: ${statusEmoji(status)} *${status}*\n\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `How many *${product.product_name}* were produced today?\n` +
                `_(Enter quantity or type *skip*)_`
            );
            return true;
        }

        // ── Step 6: Quantity → save to Supabase ──────────────────────────────────
        case 'QUANTITY': {
            let quantity = null;
            if (input.toLowerCase() !== 'skip') {
                quantity = parseInt(input, 10);
                if (isNaN(quantity) || quantity < 0) {
                    await reply(`❌ Please enter a valid quantity (e.g. *450*) or type *skip*.`);
                    return true;
                }
            }

            const { product, samples, average, avgRounded, status, variance, senderNumber, branch } = session;
            const varianceStr = variance > 0 ? `+${variance}g` : variance < 0 ? `${variance}g` : `0g (within range)`;

            // Save to Supabase
            const savedRecord = await saveRecord({
                productId: product.id,
                samples,
                average,
                quantity,
                status,
                variance,
                recordedBy: senderNumber,
                branch,
            });

            let confirmMsg =
                `✔️ *Record Saved!*\n\n` +
                `Product:  *${product.product_name}*\n` +
                `Samples:  ${samples.join(', ')}\n` +
                `Average:  *${avgRounded}g*\n` +
                `Target:   ${product.min_weight}g – ${product.max_weight}g\n` +
                `Variance: *${varianceStr}*\n` +
                `Status:   ${statusEmoji(status)} *${status}*`;

            if (quantity !== null) confirmMsg += `\nQuantity: *${quantity} units*`;

            confirmMsg += `\n\n` +
                `Reply *1* to record another batch.\n` +
                `Reply *2* to delete this batch.\n` +
                `Reply *3* to Submit Today's Report to Group.`;

            try {
                const todayRecords = await getTodayRecords();
                const branchRecords = todayRecords.filter(r => r.branch === branch);
                const recordedProductIds = new Set(branchRecords.map(r => r.product_id));
                const recordedNumbers = [];
                session.products.forEach((p, index) => {
                    if (recordedProductIds.has(p.id)) {
                        recordedNumbers.push(index + 1);
                    }
                });

                if (recordedNumbers.length > 0) {
                    confirmMsg += `\n\n💡 _You have recorded product ${recordedNumbers.join(', ')} today._`;
                }
            } catch (err) {
                console.error('Error fetching today records for msg:', err);
            }

            // Transition to new POST_SAVE step instead of clearing
            setSession(jid, { ...session, step: 'POST_SAVE', recordId: savedRecord.id });
            await reply(confirmMsg);
            return true;
        }

        // ── Step 7: Post-Save Options ────────────────────────────────────────────
        case 'POST_SAVE': {
            if (input === '1') {
                // Restart weighing process efficiently
                let menu = '📋 *Please select the product you are weighing:*\n\n';
                session.products.forEach((p, i) => {
                    menu += `${NUMBER_EMOJIS[i]} ${p.product_name}\n`;
                });
                menu += '\nReply with the *number* of the product.';

                setSession(jid, {
                    step: 'SELECT_PRODUCT',
                    senderNumber: session.senderNumber,
                    branch: session.branch,
                    products: session.products,
                    samples: []
                });
                await reply(menu);
                return true;
            } else if (input === '2') {
                // Delete the record
                await deleteRecord(session.recordId);
                clearSession(jid);
                await reply(`🗑️ *Batch Deleted.*\n\nThat batch has been removed from today's records.`);
                return true;
            } else if (input === '3') {
                let recordedProductsMsg = '';
                try {
                    const todayRecords = await getTodayRecords();
                    const branchRecords = todayRecords.filter(r => r.branch === session.branch);
                    const recordedProductIds = new Set(branchRecords.map(r => r.product_id));
                    const recordedNames = [];
                    session.products.forEach(p => {
                        if (recordedProductIds.has(p.id)) {
                            recordedNames.push(p.product_name);
                        }
                    });

                    if (recordedNames.length > 0) {
                        recordedProductsMsg = `📋 *Summary of Recorded Products:*\n${recordedNames.map(name => `• ${name}`).join('\n')}\n\n`;
                    }
                } catch (err) {
                    console.error('Error fetching today records for summary:', err);
                }

                // Ask for flour before submitting
                setSession(jid, { ...session, step: 'FLOUR_INPUT' });
                await reply(
                    `🌾 *Before submitting the report:*\n\n` +
                    `How many *kg of flour* were used today across the whole production?\n` +
                    `_(Enter a number, e.g. *250*)_\n\n` +
                    recordedProductsMsg +
                    `Type *back* to:\n` +
                    `1. Record another batch\n` +
                    `2. Delete this batch`
                );
                return true;
            } else {
                await reply(`❌ Invalid option.\n\nReply *1* to record another batch.\nReply *2* to delete the one you just made.\nReply *3* to Submit Today's Report to Group.`);
                return true;
            }
        }

        // ── Step: Flour input → submit report ───────────────────────────────────
        case 'FLOUR_INPUT': {
            if (input.toLowerCase() === 'back') {
                setSession(jid, { ...session, step: 'POST_SAVE' });
                await reply(
                    `Reply *1* to record another batch.\n` +
                    `Reply *2* to delete this batch.`
                );
                return true;
            }

            const flourKg = parseFloat(input);
            if (isNaN(flourKg) || flourKg <= 0) {
                await reply(`❌ Please enter a valid flour amount in kg (e.g. *250*).`);
                return true;
            }

            // Save flour log to DB
            try {
                await saveFlourLog({ branch: session.branch, flourKg, recordedBy: session.senderNumber });
            } catch (err) {
                console.error('Failed to save flour log:', err.message);
            }

            await reply(`⏳ Compiling today's report for ${session.branch}...`);

            const success = await sendBranchReport(session.branch, flourKg);
            clearSession(jid);

            if (success) {
                await reply(`✅ Today's report has been sent to the ${session.branch} group!`);
            } else {
                await reply(`⚠️ Could not send the report. Ensure the ${session.branch} WhatsApp Group is properly linked in the system.`);
            }
            return true;
        }

        default:
            // Only clear if this isn't an admin session — adminHandler will handle those
            if (!session.step.startsWith('ADMIN_')) clearSession(jid);
            return false;
    }
}

module.exports = { startWeigh, handleWeighStep };
