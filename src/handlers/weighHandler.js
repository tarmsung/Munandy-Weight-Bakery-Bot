const { getAllProducts } = require('../db/products');
const { saveRecord } = require('../db/records');
const { getSupervisorBranch } = require('../db/supervisors');
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
            await saveRecord({
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
            confirmMsg += `\n\n_Type /weigh to record another batch._`;

            clearSession(jid);
            await reply(confirmMsg);
            return true;
        }

        default:
            // Only clear if this isn't an admin session — adminHandler will handle those
            if (!session.step.startsWith('ADMIN_')) clearSession(jid);
            return false;
    }
}

module.exports = { startWeigh, handleWeighStep };
