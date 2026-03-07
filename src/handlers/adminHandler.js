const { getAllProducts, addProduct, updateProductRange } = require('../db/products');
const { getAllSupervisors, addSupervisor, removeSupervisor } = require('../db/supervisors');
const { getSession, setSession, clearSession } = require('../sessions/sessionManager');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣'];

const ADMIN_MENU_TEXT =
    `👑 *Admin Settings Menu*\n\n` +
    `1️⃣ Add a Supervisor\n` +
    `2️⃣ Remove a Supervisor\n` +
    `3️⃣ Add a new Product\n` +
    `4️⃣ Change accepted weights for a Product\n` +
    `5️⃣ Exit Admin Mode\n\n` +
    `_Reply with a number. Type *back* at any step to return here._`;

async function startAdminMenu(sock, jid, senderNumber) {
    setSession(jid, { step: 'ADMIN_MENU', senderNumber });
    await sock.sendMessage(jid, { text: ADMIN_MENU_TEXT });
}

/** Re-show the menu and reset session step to ADMIN_MENU. */
async function backToMenu(sock, jid, session, reply, prefix = '') {
    setSession(jid, { step: 'ADMIN_MENU', senderNumber: session.senderNumber });
    await reply(`${prefix}${ADMIN_MENU_TEXT}`);
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

    // ── Global back / cancel ──────────────────────────────────────────────────
    if (['back', '0', 'cancel', 'menu'].includes(input.toLowerCase()) && session.step !== 'ADMIN_MENU') {
        await backToMenu(sock, jid, session, reply, '↩️ Back to menu.\n\n');
        return true;
    }

    try {
        switch (session.step) {
            case 'ADMIN_MENU': {
                const choice = parseInt(input, 10);
                if (choice === 1) {
                    setSession(jid, { ...session, step: 'ADMIN_ADD_SUPERVISOR' });
                    await reply(
                        `➕ *Add Supervisor*\n\n` +
                        `Enter the new supervisor's full WhatsApp number including country code, but no '+' sign (e.g. 263712345678).\n\n` +
                        `_Type *back* to return to the menu._`
                    );
                } else if (choice === 2) {
                    const supervisors = await getAllSupervisors();
                    if (supervisors.length === 0) {
                        await backToMenu(sock, jid, session, reply, `❌ No supervisors are currently in the system.\n\n`);
                        return true;
                    }
                    setSession(jid, { ...session, step: 'ADMIN_REMOVE_SUPERVISOR', list: supervisors });
                    let msg = `➖ *Remove Supervisor*\n\n`;
                    supervisors.forEach((s, idx) => {
                        msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '.')} +${s.phone_number}\n`;
                    });
                    msg += `\n_Reply with the number to remove, or type *back* to return._`;
                    await reply(msg);
                } else if (choice === 3) {
                    setSession(jid, { ...session, step: 'ADMIN_ADD_PRODUCT_NAME' });
                    await reply(
                        `🍞 *Add New Product*\n\nWhat is the name of the new product? (e.g. "Burger Buns (6)")\n\n` +
                        `_Type *back* to return to the menu._`
                    );
                } else if (choice === 4) {
                    const products = await getAllProducts();
                    setSession(jid, { ...session, step: 'ADMIN_SELECT_PRODUCT_UPDATE', list: products });
                    let msg = `⚖️ *Update Product Weights*\n\n`;
                    products.forEach((p, idx) => {
                        msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '.')} ${p.product_name} (${p.min_weight}g–${p.max_weight}g)\n`;
                    });
                    msg += `\n_Reply with the number of the product to update, or type *back*._`;
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
                    await reply(`❌ Invalid number. Enter exactly like: 263712345678\n\n_Type *back* to return to the menu._`);
                    return true;
                }
                await addSupervisor(num);
                await backToMenu(sock, jid, session, reply, `✅ Supervisor +${num} has been added.\n\n`);
                return true;
            }

            case 'ADMIN_REMOVE_SUPERVISOR': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice. Enter a number from the list, or type *back*._`);
                    return true;
                }
                const num = session.list[idx].phone_number;
                await removeSupervisor(num);
                await backToMenu(sock, jid, session, reply, `✅ Supervisor +${num} removed.\n\n`);
                return true;
            }

            // --- Product Management ---
            case 'ADMIN_ADD_PRODUCT_NAME': {
                setSession(jid, { ...session, step: 'ADMIN_ADD_PRODUCT_MIN', tempName: input });
                await reply(
                    `Product Name: *${input}*\n\n` +
                    `Now, what is the *MINIMUM* accepted weight in grams? (e.g. 155)\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }
            case 'ADMIN_ADD_PRODUCT_MIN': {
                const min = parseFloat(input);
                if (isNaN(min) || min <= 0) {
                    await reply(`❌ Enter a valid number.\n\n_Type *back* to return to the menu._`);
                    return true;
                }
                setSession(jid, { ...session, step: 'ADMIN_ADD_PRODUCT_MAX', tempMin: min });
                await reply(
                    `Minimum: *${min}g*\n\n` +
                    `Now, what is the *MAXIMUM* accepted weight in grams? (e.g. 165)\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }
            case 'ADMIN_ADD_PRODUCT_MAX': {
                const max = parseFloat(input);
                if (isNaN(max) || max < session.tempMin) {
                    await reply(`❌ Enter a valid maximum weight (must be ≥ ${session.tempMin}g).\n\n_Type *back* to return to the menu._`);
                    return true;
                }
                await addProduct(session.tempName, session.tempMin, max);
                await backToMenu(sock, jid, session, reply, `✅ *Product Added!*\n${session.tempName}: ${session.tempMin}g – ${max}g\n\n`);
                return true;
            }

            // --- Product Weight Updating ---
            case 'ADMIN_SELECT_PRODUCT_UPDATE': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice. Enter a number from the list, or type *back*._`);
                    return true;
                }
                const selected = session.list[idx];
                setSession(jid, { ...session, step: 'ADMIN_UPDATE_PRODUCT_MIN', selectedProduct: selected });
                await reply(
                    `Updating *${selected.product_name}* (Current: ${selected.min_weight}g–${selected.max_weight}g).\n\n` +
                    `Enter the new *MINIMUM* weight limit:\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }
            case 'ADMIN_UPDATE_PRODUCT_MIN': {
                const min = parseFloat(input);
                if (isNaN(min) || min <= 0) {
                    await reply(`❌ Enter a valid number.\n\n_Type *back* to return to the menu._`);
                    return true;
                }
                setSession(jid, { ...session, step: 'ADMIN_UPDATE_PRODUCT_MAX', tempMin: min });
                await reply(
                    `New Minimum: *${min}g*\n\n` +
                    `Enter the new *MAXIMUM* weight limit:\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }
            case 'ADMIN_UPDATE_PRODUCT_MAX': {
                const max = parseFloat(input);
                if (isNaN(max) || max < session.tempMin) {
                    await reply(`❌ Enter a valid maximum weight (must be ≥ ${session.tempMin}g).\n\n_Type *back* to return to the menu._`);
                    return true;
                }
                const selected = session.selectedProduct;
                await updateProductRange(selected.id, session.tempMin, max);
                await backToMenu(sock, jid, session, reply,
                    `✅ *Product Updated!*\n${selected.product_name}: ${session.tempMin}g – ${max}g\n\n`
                );
                return true;
            }

            default:
                clearSession(jid);
                return false;
        }
    } catch (err) {
        console.error('Admin Handle Error:', err);
        await backToMenu(sock, jid, session, reply, `❌ Error: ${err.message}\n\n`);
        return true;
    }
}

module.exports = { startAdminMenu, handleAdminStep };
