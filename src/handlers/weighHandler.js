const { getAllProducts } = require('../db/products');
const { saveRecord, deleteRecord } = require('../db/records');
const { getSupervisorBranch } = require('../db/supervisors');
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
            setSession(jid, { ...session, step: 'SAMPLE_1', product });
            await reply(
                `✅ *Product selected: ${product.product_name}*\n\n` +
                `Now enter the 4 sample weights one at a time.\n\n*Sample 1?*`
            );
            return true;
        }

        // ── Steps 2–4: First three samples ───────────────────────────────────────
        case 'SAMPLE_1':
        case 'SAMPLE_2':
        case 'SAMPLE_3': {
            const sampleNum = parseInt(session.step.replace('SAMPLE_', ''), 10);
            const weight = parseFloat(input);
            if (isNaN(weight) || weight <= 0) {
                await reply(`❌ Please enter a valid weight (e.g. *341*).`);
                return true;
            }
            const newSamples = [...session.samples, weight];
            setSession(jid, { ...session, step: `SAMPLE_${sampleNum + 1}`, samples: newSamples });
            await reply(`*Sample ${sampleNum + 1}?*`);
            return true;
        }

        // ── Step 5: Fourth sample → calculate ────────────────────────────────────
        case 'SAMPLE_4': {
            const weight = parseFloat(input);
            if (isNaN(weight) || weight <= 0) {
                await reply(`❌ Please enter a valid weight (e.g. *360*).`);
                return true;
            }

            const allSamples = [...session.samples, weight];
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
                // Submit manual branch report
                await reply(`⏳ Compiling today's report for ${session.branch}...`);

                const success = await sendBranchReport(session.branch);
                clearSession(jid);

                if (success) {
                    await reply(`✅ Today's report has been sent to the ${session.branch} group!`);
                } else {
                    await reply(`⚠️ Could not send the report. Ensure the ${session.branch} WhatsApp Group is properly linked in the system.`);
                }
                return true;
            } else {
                await reply(`❌ Invalid option.\n\nReply *1* to record another batch.\nReply *2* to delete the one you just made.\nReply *3* to Submit Today's Report to Group.`);
                return true;
            }
        }

        default:
            // Only clear if this isn't an admin session — adminHandler will handle those
            if (!session.step.startsWith('ADMIN_')) clearSession(jid);
            return false;
    }
}

module.exports = { startWeigh, handleWeighStep };
