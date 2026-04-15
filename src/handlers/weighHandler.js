const { getAllProducts } = require('../db/products');
const { saveRecord, deleteRecord, getTodayRecords, updateRecord } = require('../db/records');
const { getSupervisorBranch } = require('../db/supervisors');
const { saveFlourLog } = require('../db/flourLogs');
const { sendBranchReport } = require('../scheduler');
const { getSession, setSession, clearSession } = require('../sessions/sessionManager');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣', '1️⃣6️⃣', '1️⃣7️⃣', '1️⃣8️⃣', '1️⃣9️⃣', '2️⃣0️⃣'];

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
    menu += '\nReply with the *number* of the product, or type *cancel* to end.';

    setSession(jid, { flowType: 'weigh', step: 'SELECT_PRODUCT', senderNumber, branch, products, samples: [] });
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
    const inputLower = input.toLowerCase();
    console.log(`[DEBUG] handleWeighStep: step=${session.step}, input="${input}"`);

    switch (session.step) {
        // ── Step 1: Worker picks product ─────────────────────────────────────────
        case 'SELECT_PRODUCT': {
            const num = parseInt(input, 10);
            if (isNaN(num) || num < 1 || num > session.products.length) {
                await reply(`❌ Please enter a number between 1 and ${session.products.length}.`);
                return true;
            }
            const product = session.products[num - 1];

            try {
                const todayRecords = await getTodayRecords();
                const branchRecords = todayRecords.filter(r => r.branch === session.branch);
                const existingRecord = branchRecords.find(r => r.product_id === product.id);

                if (existingRecord) {
                    setSession(jid, {
                        ...session,
                        step: 'EDIT_OR_RECORD_CHOICE',
                        product,
                        existingRecordId: existingRecord.id
                    });
                    await reply(
                        `⚠️ *Notice: You have already recorded ${product.product_name} today.*\n\n` +
                        `What would you like to do?\n` +
                        `1. Edit the batch\n` +
                        `2. Delete it completely\n` +
                        `3. Record another batch (different product)`
                    );
                    return true;
                }
            } catch (err) {
                console.error('Error checking existing records:', err);
            }

            setSession(jid, { ...session, step: 'ENTER_SAMPLES', product, isEditing: false });
            await reply(
                `✅ *Product selected: ${product.product_name}*\n\n` +
                `Enter all *4 sample weights* separated by commas.\n` +
                `Example: _341, 352, 348, 355_`
            );
            return true;
        }

        // ── Step 1.5: Edit or Record Choice ─────────────────────────────────────────
        case 'EDIT_OR_RECORD_CHOICE': {
            if (input === '1') {
                setSession(jid, { ...session, step: 'ENTER_SAMPLES', isEditing: true });
                await reply(
                    `✏️ *Editing ${session.product.product_name}*\n\n` +
                    `Enter all *4 NEW sample weights* separated by commas.\n` +
                    `Example: _341, 352, 348, 355_`
                );
                return true;
            } else if (input === '2') {
                await deleteRecord(session.existingRecordId);

                let menu = '📋 *Please select the product you are weighing:*\n\n';
                session.products.forEach((p, i) => {
                    menu += `${NUMBER_EMOJIS[i]} ${p.product_name}\n`;
                });
                menu += '\nReply with the *number* of the product.';

                setSession(jid, {
                    flowType: 'weigh',
                    step: 'SELECT_PRODUCT',
                    senderNumber: session.senderNumber,
                    branch: session.branch,
                    products: session.products,
                    samples: []
                });
                await reply(`🗑️ *Batch Deleted.*\n\nThat batch has been removed from today's records.\n\n` + menu);
                return true;
            } else if (input === '3') {
                let menu = '📋 *Please select the product you are weighing:*\n\n';
                session.products.forEach((p, i) => {
                    menu += `${NUMBER_EMOJIS[i]} ${p.product_name}\n`;
                });
                menu += '\nReply with the *number* of the product.';

                setSession(jid, {
                    flowType: 'weigh',
                    step: 'SELECT_PRODUCT',
                    senderNumber: session.senderNumber,
                    branch: session.branch,
                    products: session.products,
                    samples: []
                });
                await reply(menu);
                return true;
            } else {
                await reply(`❌ Invalid option.\n\n1. Edit the batch\n2. Delete it completely\n3. Record another batch`);
                return true;
            }
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
            setSession(jid, { ...session, step: 'FINISH_TYPE', samples: allSamples });

            await reply(
                `🍰 *How were the ${session.product.product_name} finished?*\n\n` +
                `1️⃣ Creamed\n` +
                `2️⃣ Iced\n` +
                `3️⃣ Skip\n\n` +
                `Reply with *1*, *2*, or *3*.`
            );
            return true;
        }

        // ── Step 3: Finish type → calculate actuals ─────────────────────────────
        case 'FINISH_TYPE': {
            let finishType = null;
            if (input === '1') finishType = 'Creamed';
            else if (input === '2') finishType = 'Iced';
            else if (input === '3') finishType = null; // Skip
            else {
                await reply(`❌ Please reply *1* for Creamed, *2* for Iced, or *3* to Skip.`);
                return true;
            }

            const { product, samples } = session;
            const rawAvg = samples.reduce((a, b) => a + b, 0) / 4;
            const rawAvgRounded = Math.round(rawAvg);

            let effectiveAvg = rawAvg;
            if (finishType === 'Creamed' || finishType === 'Iced') {
                effectiveAvg -= 20;
            }
            const avgRounded = Math.round(effectiveAvg);
            const status = calcStatus(effectiveAvg, product.min_weight, product.max_weight);

            // Variance = how far outside the range (0 if optimal)
            let variance = 0;
            if (status === 'Overweight') variance = parseFloat((effectiveAvg - product.max_weight).toFixed(1));
            if (status === 'Underweight') variance = parseFloat((effectiveAvg - product.min_weight).toFixed(1));
            const varianceStr = variance > 0 ? `+${variance}g` : variance < 0 ? `${variance}g` : `0g (within range)`;

            setSession(jid, { ...session, step: 'QUANTITY', finishType, rawAverage: rawAvg, average: effectiveAvg, avgRounded, status, variance });

            let calcMsg = `📊 *Calculation Result*\n\n`;
            if (finishType) {
                calcMsg += `Product: *${product.product_name} (${finishType})*\n`;
            } else {
                calcMsg += `Product: *${product.product_name}*\n`;
            }

            calcMsg += `Samples: ${samples.join(', ')}\n`;
            if (finishType) {
                calcMsg += `Raw Average: ${rawAvgRounded}g\n`;
                calcMsg += `Adjusted Average: *${avgRounded}g* (-20g for ${finishType})\n`;
            } else {
                calcMsg += `Average: *${avgRounded}g*\n`;
            }

            calcMsg += `Target:  ${product.min_weight}g – ${product.max_weight}g\n` +
                `Variance: *${varianceStr}*\n\n` +
                `Status: ${statusEmoji(status)} *${status}*\n\n` +
                `━━━━━━━━━━━━━━━━━━\n` +
                `How many *${product.product_name}* were produced today?\n` +
                `_(Enter quantity or type *skip*)_`;

            await reply(calcMsg);
            return true;
        }

        // ── Step 4: Quantity → save to Supabase ───────────────────────────────────
        case 'QUANTITY': {
            let quantity = null;
            if (input.toLowerCase() !== 'skip') {
                quantity = parseInt(input, 10);
                if (isNaN(quantity) || quantity < 0) {
                    await reply(`❌ Please enter a valid quantity (e.g. *450*) or type *skip*.`);
                    return true;
                }
            }

            const { product, samples, average, avgRounded, status, variance, finishType, senderNumber, branch } = session;
            const varianceStr = variance > 0 ? `+${variance}g` : variance < 0 ? `${variance}g` : `0g (within range)`;

            // Save or Update Supabase
            let savedRecord;
            if (session.isEditing) {
                savedRecord = await updateRecord(session.existingRecordId, {
                    samples,
                    average,
                    quantity,
                    status,
                    variance,
                    finishType,
                });
            } else {
                savedRecord = await saveRecord({
                    productId: product.id,
                    samples,
                    average,
                    quantity,
                    status,
                    variance,
                    finishType,
                    recordedBy: senderNumber,
                    branch,
                });
            }

            let productNameDisplay = product.product_name;
            if (finishType) productNameDisplay += ` (${finishType})`;

            let confirmMsg =
                `✔️ *${session.isEditing ? 'Record Updated!' : 'Record Saved!'}*\n\n` +
                `Product:  *${productNameDisplay}*\n` +
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

            // Transition to POST_SAVE
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
                    flowType: 'weigh',
                    step: 'SELECT_PRODUCT',
                    senderNumber: session.senderNumber,
                    branch: session.branch,
                    products: session.products,
                    samples: []
                });
                await reply(menu);
                return true;
            } else if (input === '2') {
                // Delete the record and return to menu
                await deleteRecord(session.recordId);

                let menu = '📋 *Please select the product you are weighing:*\n\n';
                session.products.forEach((p, i) => {
                    menu += `${NUMBER_EMOJIS[i]} ${p.product_name}\n`;
                });
                menu += '\nReply with the *number* of the product.';

                setSession(jid, {
                    flowType: 'weigh',
                    step: 'SELECT_PRODUCT',
                    senderNumber: session.senderNumber,
                    branch: session.branch,
                    products: session.products,
                    samples: []
                });
                await reply(`🗑️ *Batch Deleted.*\n\nThat batch has been removed from today's records.\n\n` + menu);
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
            // Only clear if this isn't an admin or delete session — those handlers will handle them
            if (!session.step.startsWith('ADMIN_') && !session.step.startsWith('DELETE_')) clearSession(jid);
            return false;
    }
}

module.exports = { startWeigh, handleWeighStep };
