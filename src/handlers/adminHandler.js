const { getAllProducts, addProduct, updateProductRange, deleteProduct } = require('../db/products');
const { getAllSupervisors, addSupervisor, removeSupervisor } = require('../db/supervisors');
const { addDriver, deleteDriver, getAllDrivers, addVehicle, deleteVehicle, getAllActiveVehicles } = require('../db/vehicles');
const { getAllInsuranceStatus, upsertInsurance } = require('../db/insurance');
const { getSession, setSession, clearSession } = require('../sessions/sessionManager');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣'];

const ADMIN_MENU_TEXT =
    `👑 *Admin Settings Menu*\n\n` +
    `1️⃣ Add a Supervisor\n` +
    `2️⃣ Remove a Supervisor\n` +
    `3️⃣ Add a new Product\n` +
    `4️⃣ Change accepted weights for a Product\n` +
    `5️⃣ Delete a Product\n` +
    `6️⃣ Add a Driver\n` +
    `7️⃣ Delete a Driver\n` +
    `8️⃣ Add a Vehicle\n` +
    `9️⃣ Delete a Vehicle\n` +
    `1️⃣0️⃣ Insurance Management\n` +
    `1️⃣1️⃣ Exit Admin Mode\n\n` +
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
    console.log(`[DEBUG] handleAdminStep: step=${session.step}, input="${input}"`);

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
                    setSession(jid, { ...session, step: 'ADMIN_ADD_SUPERVISOR_BRANCH' });
                    await reply(
                        `🏢 *Select Branch for New Supervisor*\n\n` +
                        `1️⃣ Harare\n` +
                        `2️⃣ Mutare\n` +
                        `3️⃣ Bulawayo\n\n` +
                        `_Reply with a number or type *back* to return._`
                    );
                } else if (choice === 2) {
                    setSession(jid, { ...session, step: 'ADMIN_REMOVE_SUPERVISOR_BRANCH' });
                    await reply(
                        `🏢 *Select Branch to Remove Supervisor From*\n\n` +
                        `1️⃣ Harare\n` +
                        `2️⃣ Mutare\n` +
                        `3️⃣ Bulawayo\n\n` +
                        `_Reply with a number or type *back* to return._`
                    );
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
                    const products = await getAllProducts();
                    if (products.length === 0) {
                        await backToMenu(sock, jid, session, reply, `❌ No products in the system.\n\n`);
                        return true;
                    }
                    setSession(jid, { ...session, step: 'ADMIN_DELETE_PRODUCT', list: products });
                    let msg = `🗑️ *Delete Product*\n\n`;
                    products.forEach((p, idx) => {
                        msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '.')} ${p.product_name}\n`;
                    });
                    msg += `\n_Reply with the number of the product to completely delete, or type *back*._\n\n⚠️ *Warning:* This cannot be undone!`;
                    await reply(msg);
                } else if (choice === 6) {
                    setSession(jid, { ...session, step: 'ADMIN_ADD_DRIVER_ID' });
                    await reply(
                        `🚚 *Add New Driver*\n\nWhat is the Driver's ID number? (e.g. "617859")\n\n` +
                        `_Type *back* to return to the menu._`
                    );
                } else if (choice === 7) {
                    const drivers = await getAllDrivers();
                    if (drivers.length === 0) {
                        await backToMenu(sock, jid, session, reply, `❌ No drivers in the system.\n\n`);
                        return true;
                    }
                    setSession(jid, { ...session, step: 'ADMIN_DELETE_DRIVER_SELECT', list: drivers });
                    let msg = `🗑️ *Delete Driver*\n\n`;
                    drivers.forEach((d, idx) => {
                        msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '.')} ${d.name} (${d.id})\n`;
                    });
                    msg += `\n_Reply with the number of the driver to remove, or type *back*._`;
                    await reply(msg);
                } else if (choice === 8) {
                    setSession(jid, { ...session, step: 'ADMIN_ADD_VEHICLE_REG' });
                    await reply(
                        `🚐 *Add New Vehicle*\n\nWhat is the vehicle's registration number? (e.g. "AES6291")\n\n` +
                        `_Type *back* to return to the menu._`
                    );
                } else if (choice === 9) {
                    const vehicles = await getAllActiveVehicles();
                    if (vehicles.length === 0) {
                        await backToMenu(sock, jid, session, reply, `❌ No active vehicles in the system.\n\n`);
                        return true;
                    }
                    setSession(jid, { ...session, step: 'ADMIN_DELETE_VEHICLE_SELECT', list: vehicles });
                    let msg = `🗑️ *Delete Vehicle*\n\n`;
                    vehicles.forEach((v, idx) => {
                        const name = v.nickname ? `${v.make} ${v.model} (${v.nickname})` : `${v.make} ${v.model}`;
                        msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '.')} ${name} [${v.registration}]\n`;
                    });
                    msg += `\n_Reply with the number of the vehicle to remove, or type *back*._`;
                    await reply(msg);
                } else if (choice === 10) {
                    // Insurance Management
                    setSession(jid, { ...session, step: 'ADMIN_INSURANCE_MENU' });
                    await reply(
                        `🛡️ *Insurance Management*\n\n` +
                        `1️⃣ View Insurance Status\n` +
                        `2️⃣ Renew Insurance\n\n` +
                        `_Reply with a number or type *back*._`
                    );
                } else if (choice === 11) {
                    clearSession(jid);
                    await reply(`👋 Exited Admin Mode.`);
                } else {
                    await reply(`❌ Invalid choice. Please reply with 1–11.`);
                }
                return true;
            }

            // --- Supervisor Management ---
            case 'ADMIN_ADD_SUPERVISOR_BRANCH': {
                const branches = { 1: 'Harare', 2: 'Mutare', 3: 'Bulawayo' };
                const choice = parseInt(input, 10);
                const branch = branches[choice];
                if (!branch) {
                    await reply(`❌ Invalid choice. Reply with 1, 2, or 3.\n\n_Type *back* to return._`);
                    return true;
                }
                setSession(jid, { ...session, step: 'ADMIN_ADD_SUPERVISOR_PHONE', branch });
                await reply(
                    `➕ *Add Supervisor - ${branch}*\n\n` +
                    `Enter the new supervisor's full WhatsApp number including country code, but no '+' sign (e.g. 263712345678).\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }

            case 'ADMIN_ADD_SUPERVISOR_PHONE': {
                const num = input.replace(/\D/g, '');
                if (num.length < 10) {
                    await reply(`❌ Invalid number. Enter exactly like: 263712345678\n\n_Type *back* to return to the menu._`);
                    return true;
                }
                await addSupervisor(num, session.branch);
                await backToMenu(sock, jid, session, reply, `✅ Supervisor +${num} has been added to *${session.branch}*.\n\n`);
                return true;
            }

            case 'ADMIN_REMOVE_SUPERVISOR_BRANCH': {
                const branches = { 1: 'Harare', 2: 'Mutare', 3: 'Bulawayo' };
                const choice = parseInt(input, 10);
                const branch = branches[choice];
                if (!branch) {
                    await reply(`❌ Invalid choice. Reply with 1, 2, or 3.\n\n_Type *back* to return._`);
                    return true;
                }

                const supervisors = await getAllSupervisors(branch);
                if (supervisors.length === 0) {
                    await backToMenu(sock, jid, session, reply, `❌ No supervisors are currently in the *${branch}* system.\n\n`);
                    return true;
                }
                setSession(jid, { ...session, step: 'ADMIN_REMOVE_SUPERVISOR_SELECT', list: supervisors, branch });
                let msg = `➖ *Remove Supervisor - ${branch}*\n\n`;
                supervisors.forEach((s, idx) => {
                    msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '.')} +${s.phone_number}\n`;
                });
                msg += `\n_Reply with the number to remove, or type *back* to return._`;
                await reply(msg);
                return true;
            }

            case 'ADMIN_REMOVE_SUPERVISOR_SELECT': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice. Enter a number from the list, or type *back*._`);
                    return true;
                }
                const num = session.list[idx].phone_number;
                await removeSupervisor(num);
                await backToMenu(sock, jid, session, reply, `✅ Supervisor +${num} removed from *${session.branch}*.\n\n`);
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

            case 'ADMIN_DELETE_PRODUCT': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice. Enter a number from the list, or type *back*._`);
                    return true;
                }
                const selected = session.list[idx];
                try {
                    await deleteProduct(selected.id);
                    await backToMenu(sock, jid, session, reply, `✅ *Product Deleted!*\n${selected.product_name} was removed successfully.\n\n`);
                } catch (err) {
                    // This can happen if foreign key constraints fail on weight_records
                    await backToMenu(sock, jid, session, reply, `❌ *Failed to delete!*\nThe product cannot be deleted because it already has weight records linked to it.\n\n`);
                }
                return true;
            }

            // --- Driver Management ---
            case 'ADMIN_ADD_DRIVER_ID': {
                setSession(jid, { ...session, step: 'ADMIN_ADD_DRIVER_NAME', tempId: input });
                await reply(
                    `Driver ID: *${input}*\n\n` +
                    `Now, what is the *NAME* of the driver?\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }
            case 'ADMIN_ADD_DRIVER_NAME': {
                setSession(jid, { ...session, step: 'ADMIN_ADD_DRIVER_BRANCH', tempName: input });
                await reply(
                    `Driver Name: *${input}*\n\n` +
                    `Finally, select the *BRANCH* for this driver:\n\n` +
                    `1️⃣ Harare\n` +
                    `2️⃣ Mutare\n` +
                    `3️⃣ Bulawayo\n\n` +
                    `_Reply with a number or type *back*._`
                );
                return true;
            }
            case 'ADMIN_ADD_DRIVER_BRANCH': {
                const branches = { 1: 'Harare', 2: 'Mutare', 3: 'Bulawayo' };
                const choice = parseInt(input, 10);
                const branch = branches[choice];
                if (!branch) {
                    await reply(`❌ Invalid choice. Reply with 1, 2, or 3.\n\n_Type *back* to return._`);
                    return true;
                }
                try {
                    await addDriver(session.tempId, session.tempName, branch);
                    await backToMenu(sock, jid, session, reply, `✅ *Driver Added!*\n${session.tempName} (${session.tempId}) - ${branch}\n\n`);
                } catch (err) {
                    await backToMenu(sock, jid, session, reply, `❌ *Failed to add driver:*\n${err.message}\n\n`);
                }
                return true;
            }
            case 'ADMIN_DELETE_DRIVER_SELECT': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice. Enter a number from the list, or type *back*._`);
                    return true;
                }
                const selected = session.list[idx];
                try {
                    await deleteDriver(selected.id);
                    await backToMenu(sock, jid, session, reply, `✅ *Driver Deleted!*\nDriver ${selected.name} (${selected.id}) was removed.\n\n`);
                } catch (err) {
                    await backToMenu(sock, jid, session, reply, `❌ *Failed to delete driver:*\n${err.message}\n\n`);
                }
                return true;
            }

            // --- Vehicle Management ---
            case 'ADMIN_ADD_VEHICLE_REG': {
                setSession(jid, { ...session, step: 'ADMIN_ADD_VEHICLE_MAKE', tempReg: input.toUpperCase() });
                await reply(
                    `Registration: *${input.toUpperCase()}*\n\n` +
                    `What is the vehicle's *MAKE*? (e.g. "Mercedes Benz")\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }
            case 'ADMIN_ADD_VEHICLE_MAKE': {
                setSession(jid, { ...session, step: 'ADMIN_ADD_VEHICLE_MODEL', tempMake: input });
                await reply(
                    `Make: *${input}*\n\n` +
                    `What is the vehicle's *MODEL*? (e.g. "Sprinter")\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }
            case 'ADMIN_ADD_VEHICLE_MODEL': {
                setSession(jid, { ...session, step: 'ADMIN_ADD_VEHICLE_NICKNAME', tempModel: input });
                await reply(
                    `Model: *${input}*\n\n` +
                    `Enter a *NICKNAME* for this vehicle (or type "none"): (e.g. "Yellow Container")\n\n` +
                    `_Type *back* to return to the menu._`
                );
                return true;
            }
            case 'ADMIN_ADD_VEHICLE_NICKNAME': {
                const nickname = input.toLowerCase() === 'none' ? '' : input;
                setSession(jid, { ...session, step: 'ADMIN_ADD_VEHICLE_BRANCH', tempNickname: nickname });
                await reply(
                    `Nickname: *${nickname || '(None)'}*\n\n` +
                    `Finally, select the *BRANCH* for this vehicle:\n\n` +
                    `1️⃣ Harare\n` +
                    `2️⃣ Mutare\n` +
                    `3️⃣ Bulawayo\n\n` +
                    `_Reply with a number or type *back*._`
                );
                return true;
            }
            case 'ADMIN_ADD_VEHICLE_BRANCH': {
                const branches = { 1: 'Harare', 2: 'Mutare', 3: 'Bulawayo' };
                const choice = parseInt(input, 10);
                const branch = branches[choice];
                if (!branch) {
                    await reply(`❌ Invalid choice. Reply with 1, 2, or 3.\n\n_Type *back* to return._`);
                    return true;
                }
                try {
                    await addVehicle({
                        registration: session.tempReg,
                        make: session.tempMake,
                        model: session.tempModel,
                        nickname: session.tempNickname,
                        branch: branch
                    });
                    await backToMenu(sock, jid, session, reply, `✅ *Vehicle Added!*\n${session.tempMake} ${session.tempModel} (${session.tempReg}) - ${branch}\n\n`);
                } catch (err) {
                    await backToMenu(sock, jid, session, reply, `❌ *Failed to add vehicle:*\n${err.message}\n\n`);
                }
                return true;
            }
            case 'ADMIN_DELETE_VEHICLE_SELECT': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice. Enter a number from the list, or type *back*._`);
                    return true;
                }
                const selected = session.list[idx];
                try {
                    await deleteVehicle(selected.registration);
                    await backToMenu(sock, jid, session, reply, `✅ *Vehicle Deleted!*\nVehicle ${selected.registration} was removed.\n\n`);
                } catch (err) {
                    await backToMenu(sock, jid, session, reply, `❌ *Failed to delete vehicle:*\n${err.message}\n\n`);
                }
                return true;
            }

            // --- Insurance Management ---
            case 'ADMIN_INSURANCE_MENU': {
                const choice = parseInt(input, 10);
                if (choice === 1) {
                    // View all vehicle insurance status
                    const allInsurance = await getAllInsuranceStatus();
                    const today = new Date().toISOString().split('T')[0];
                    let msg = `🛡️ *Vehicle Insurance Status*\n\n`;
                    allInsurance.forEach(v => {
                        const ins = v.vehicle_insurance && v.vehicle_insurance.length > 0 ? v.vehicle_insurance[0] : null;
                        const name = `${v.make} ${v.nickname || v.registration}`;
                        if (!ins) {
                            msg += `🔴 *${name}* [${v.registration}]\n   _No insurance on record_\n`;
                        } else {
                            const dueDate = ins.insurance_due;
                            const isExpired = dueDate < today;
                            const emoji = isExpired ? '🔴' : '🟢';
                            const status = isExpired ? 'EXPIRED' : 'Active';
                            msg += `${emoji} *${name}* [${v.registration}]\n   Policy: ${ins.policy_number || 'N/A'} | Expires: ${dueDate} (${status})\n`;
                        }
                    });
                    await reply(msg);
                    await backToMenu(sock, jid, session, reply, `\n`);
                } else if (choice === 2) {
                    // Renew insurance – pick a vehicle
                    const vehicles = await getAllActiveVehicles();
                    if (vehicles.length === 0) {
                        await backToMenu(sock, jid, session, reply, `❌ No active vehicles found.\n\n`);
                        return true;
                    }
                    setSession(jid, { ...session, step: 'ADMIN_RENEW_INSURANCE_SELECT', list: vehicles });
                    let msg = `🛡️ *Renew Insurance — Select Vehicle*\n\n`;
                    vehicles.forEach((v, idx) => {
                        const name = v.nickname ? `${v.make} ${v.nickname}` : `${v.make} ${v.model}`;
                        msg += `${NUMBER_EMOJIS[idx] || (idx + 1 + '.')} ${name} [${v.registration}]\n`;
                    });
                    msg += `\n_Reply with the number of the vehicle, or type *back*._`;
                    await reply(msg);
                } else {
                    await reply(`❌ Invalid choice. Reply with 1 or 2, or type *back*._`);
                }
                return true;
            }

            case 'ADMIN_RENEW_INSURANCE_SELECT': {
                const idx = parseInt(input, 10) - 1;
                if (isNaN(idx) || idx < 0 || idx >= session.list.length) {
                    await reply(`❌ Invalid choice. Enter a number from the list, or type *back*._`);
                    return true;
                }
                const selected = session.list[idx];
                setSession(jid, { ...session, step: 'ADMIN_RENEW_INSURANCE_EXPIRY', selectedVehicle: selected });
                await reply(
                    `🛡️ *Renew Insurance — ${selected.make} ${selected.nickname || selected.registration}*\n\n` +
                    `Enter the new *EXPIRY DATE* for the insurance:\n` +
                    `Format: YYYY-MM-DD (e.g. 2026-12-31)\n\n` +
                    `_Type *back* to return._`
                );
                return true;
            }

            case 'ADMIN_RENEW_INSURANCE_EXPIRY': {
                // Validate YYYY-MM-DD
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(input) || isNaN(Date.parse(input))) {
                    await reply(`❌ Invalid date format. Please use YYYY-MM-DD (e.g. 2026-12-31).\n\n_Type *back* to return._`);
                    return true;
                }
                setSession(jid, { ...session, step: 'ADMIN_RENEW_INSURANCE_POLICY', tempExpiry: input });
                await reply(
                    `Expiry Date: *${input}*\n\n` +
                    `Enter the *POLICY NUMBER* (or type "none" to skip):\n\n` +
                    `_Type *back* to return._`
                );
                return true;
            }

            case 'ADMIN_RENEW_INSURANCE_POLICY': {
                const policy = input.toLowerCase() === 'none' ? null : input;
                const v = session.selectedVehicle;
                try {
                    await upsertInsurance(v.registration, session.tempExpiry, policy);
                    await backToMenu(sock, jid, session, reply,
                        `✅ *Insurance Updated!*\n` +
                        `*${v.make} ${v.nickname || v.registration}* [${v.registration}]\n` +
                        `Expires: ${session.tempExpiry}\n` +
                        `Policy: ${policy || 'N/A'}\n\n`
                    );
                } catch (err) {
                    await backToMenu(sock, jid, session, reply, `❌ *Failed to update insurance:*\n${err.message}\n\n`);
                }
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
