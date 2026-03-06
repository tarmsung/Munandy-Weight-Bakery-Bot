const { getAllProducts, addProduct, updateProductRange } = require('../db/products');
const { getAllSupervisors, addSupervisor, removeSupervisor } = require('../db/supervisors');
const { getSession, setSession, clearSession } = require('../sessions/sessionManager');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣'];

async function startAdminMenu(sock, jid, senderNumber) {
    const menu = `👑 *Admin Settings Menu*\n\n` +
        `1️⃣ Add a Supervisor\n` +
        `2️⃣ Remove a Supervisor\n` +
        `3️⃣ Add a new Product\n` +
        `4️⃣ Change accepted weights for a Product\n` +
        `5️⃣ Exit Admin Mode\n\n` +
        `_Reply with a number._`;

    setSession(jid, { step: 'ADMIN_MENU', senderNumber });
    await sock.sendMessage(jid, { text: menu });
}

/**
 * Handle admin interactive flows.
 * @returns {Promise<boolean>} Return true if handled, false if not an active admin session.
 */
async function handleAdminStep(sock, msg, text, jid) {
    const session = getSession(jid);
    if (!session || !session.step.startsWith('ADMIN_')) return false;

    const reply = (message) => sock.sendMessage(jid, { text: message }, { quoted: msg });
    const input = text.trim();

    try {
        switch (session.step) {
            case 'ADMIN_MENU': {
                const choice = parseInt(input, 10);
                if (choice === 1) {
                    setSession(jid, { ...session, step: 'ADMIN_ADD_SUPERVISOR' });
                    await reply(`➕ *Add Supervisor*\n\nEnter the new supervisor's full WhatsApp number including country code, but no '+' sign (e.g. 263712345678).`);
                } else if (choice === 2) {
                    const supervisors = await getAllSupervisors();
                    if (supervisors.length === 0) {
                        clearSession(jid);
                        await reply(`❌ No supervisors are currently in the system.`);
                        return true;
                    }
                    setSession(jid, { ...session, step: 'ADMIN_REMOVE_SUPERVISOR', list: supervisors });
                    let msg = `➖ *Remove Supervisor*\n\n`;
                    supervisors.forEach((s, idx) => {
                        msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '️⃣')} +${s.phone_number}\n`;
                    });
                    msg += `\n_Reply with the number to remove._`;
                    await reply(msg);
                } else if (choice === 3) {
                    setSession(jid, { ...session, step: 'ADMIN_ADD_PRODUCT_NAME' });
                    await reply(`🍞 *Add New Product*\n\nWhat is the name of the new product? (e.g. "Burger Buns (6)")`);
                } else if (choice === 4) {
                    const products = await getAllProducts();
                    setSession(jid, { ...session, step: 'ADMIN_SELECT_PRODUCT_UPDATE', list: products });
                    let msg = `⚖️ *Update Product Weights*\n\n`;
                    products.forEach((p, idx) => {
                        msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '️⃣')} ${p.product_name} (${p.min_weight}g-${p.max_weight}g)\n`;
                    });
                    msg += `\n_Reply with the number of the product to update._`;
                    await reply(msg);
                } else if (choice === 5) {
                    clearSession(jid);
                    await reply(`👋 Exited Admin Mode.`);
                } else {
                    await reply(`❌ Invalid choice. Please reply with 1, 2, 3, 4, or 5.`);
                }
                return true;
            }

            // --- Supervisor Management ---
            case 'ADMIN_ADD_SUPERVISOR': {
                const num = input.replace(/\D/g, '');
                if (num.length < 10) {
                    await reply(`❌ Invalid number formatting. Enter exactly like: 263712345678`);
                    return true;
                }
                await addSupervisor(num);
                clearSession(jid);
                await reply(`✅ Supervisor +${num} has been added. They will now receive the daily EOF PDFs.`);
                return true;
            }

            case 'ADMIN_REMOVE_SUPERVISOR': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice.`);
                    return true;
                }
                const num = session.list[idx].phone_number;
                await removeSupervisor(num);
                clearSession(jid);
                await reply(`✅ Supervisor +${num} removed.`);
                return true;
            }

            // --- Product Management ---
            case 'ADMIN_ADD_PRODUCT_NAME': {
                setSession(jid, { ...session, step: 'ADMIN_ADD_PRODUCT_MIN', tempName: input });
                await reply(`Product Name: *${input}*\n\nNow, what is the *MINIMUM* accepted weight in grams? (e.g. 155)`);
                return true;
            }
            case 'ADMIN_ADD_PRODUCT_MIN': {
                const min = parseFloat(input);
                if (isNaN(min) || min <= 0) {
                    await reply(`❌ Enter a valid number.`);
                    return true;
                }
                setSession(jid, { ...session, step: 'ADMIN_ADD_PRODUCT_MAX', tempMin: min });
                await reply(`Minimum: *${min}g*\n\nNow, what is the *MAXIMUM* accepted weight in grams? (e.g. 165)`);
                return true;
            }
            case 'ADMIN_ADD_PRODUCT_MAX': {
                const max = parseFloat(input);
                if (isNaN(max) || max < session.tempMin) {
                    await reply(`❌ Enter a valid maximum weight (must be greater than or equal to ${session.tempMin}g).`);
                    return true;
                }
                await addProduct(session.tempName, session.tempMin, max);
                clearSession(jid);
                await reply(`✅ *Product Added!*\n\n${session.tempName}: ${session.tempMin}g - ${max}g`);
                return true;
            }

            // --- Product Weight Updating ---
            case 'ADMIN_SELECT_PRODUCT_UPDATE': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice.`);
                    return true;
                }
                const selected = session.list[idx];
                setSession(jid, { ...session, step: 'ADMIN_UPDATE_PRODUCT_MIN', selectedProduct: selected });
                await reply(`Updating *${selected.product_name}* (Current: ${selected.min_weight}g-${selected.max_weight}g).\n\nEnter the new *MINIMUM* weight limit:`);
                return true;
            }
            case 'ADMIN_UPDATE_PRODUCT_MIN': {
                const min = parseFloat(input);
                if (isNaN(min) || min <= 0) {
                    await reply(`❌ Enter a valid number.`);
                    return true;
                }
                setSession(jid, { ...session, step: 'ADMIN_UPDATE_PRODUCT_MAX', tempMin: min });
                await reply(`New Minimum: *${min}g*\n\nEnter the new *MAXIMUM* weight limit:`);
                return true;
            }
            case 'ADMIN_UPDATE_PRODUCT_MAX': {
                const max = parseFloat(input);
                if (isNaN(max) || max < session.tempMin) {
                    await reply(`❌ Enter a valid maximum weight (must be greater than or equal to ${session.tempMin}g).`);
                    return true;
                }
                const selected = session.selectedProduct;
                await updateProductRange(selected.id, session.tempMin, max);
                clearSession(jid);
                await reply(`✅ *Product Updated!*\n\n${selected.product_name} range is now ${session.tempMin}g - ${max}g.`);
                return true;
            }

            default:
                clearSession(jid);
                return false;
        }
    } catch (err) {
        console.error('Admin Handle Error:', err);
        await reply(`❌ Error parsing request: ${err.message}`);
        clearSession(jid);
        return true;
    }
}

module.exports = { startAdminMenu, handleAdminStep };
