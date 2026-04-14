const { lookupDriverAndVehicle, saveInspectionReport, updateReport, getAllDrivers } = require('../db/vehicles');
const { getSession, setSession, clearSession } = require('../sessions/sessionManager');
const checklistItems = require('./checklist');
const reportHelper = require('./report');

/** Start a new /van session */
async function startVan(sock, jid) {
    setSession(jid, { flowType: 'van', step: 'AWAITING_VEHICLE_REG' });
    await sock.sendMessage(jid, { text: "Welcome to the Vehicle Check System. Please enter your Driver ID." });
}

/** Helper to orchestrate checklist flow */
async function askNextChecklistItem(sock, jid, session) {
    if (session.checklistIndex < checklistItems.length) {
        const item = checklistItems[session.checklistIndex];
        const prefix = session.isEditing ? "(Editing) " : "";
        
        let msg;
        if (item.endsWith('?')) {
            msg = `${prefix}${item}\n\nReply *Y* for yes or *N* for no, or *cancel* to end the session.`;
        } else {
            msg = `${prefix}${item} in good condition? Reply *Y* for yes or *N* for no, or *cancel* to end the session.`;
        }
        await sock.sendMessage(jid, { text: msg });
    } else {
        // Checklist complete
        setSession(jid, { ...session, step: 'AWAITING_COMMENTS' });
        await sock.sendMessage(jid, { text: "Please enter any additional comments, or reply *none*." });
    }
}

/** Finalize and save the inspection report */
async function finalizeSubmission(sock, jid, session) {
    try {
        if (session.isEditing) {
            // UPDATE
            await updateReport(session.editingReportId, 'van', {
                checklist: session.checklistResults,
                comments:  session.comments || ''
            });
            // Regenerate image with Edited label
            await reportHelper.sendReportToGroup(sock, { ...session, isEdited: true });
            await sock.sendMessage(jid, { text: "Report updated successfully. ✅" });
        } else {
            // INSERT
            const reportData = {
                driverId:     session.driverID,
                vehicleReg:   session.vehicleReg,
                checklist:    session.checklistResults,
                comments:     session.comments || '',
                reporterJid:  jid
            };
            await saveInspectionReport(reportData);
            await reportHelper.sendReportToGroup(sock, session);
            await sock.sendMessage(jid, { text: "Report submitted successfully. Have a safe trip! 🚗" });
        }
    } catch (err) {
        console.error("Failed to save/update report:", err);
        await sock.sendMessage(jid, { text: "An error occurred while saving your report. Please contact an administrator." });
    }
    
    // Cleanup
    clearSession(jid);
}


/** Handle each step of an active van session */
async function handleVanStep(sock, msg, text, jid) {
    const session = getSession(jid);
    if (!session || session.flowType !== 'van') return false;

    const input = text.trim();
    const textLower = input.toLowerCase();

    switch (session.step) {
        case 'AWAITING_VEHICLE_REG':
            setSession(jid, { ...session, driverID: input, step: 'CONFIRM_DETAILS' });
            await sock.sendMessage(jid, { text: "Please enter your vehicle registration number." });
            return true;

        case 'CONFIRM_DETAILS': {
            setSession(jid, { ...session, vehicleReg: input });
            
            const lookupResult = await lookupDriverAndVehicle(session.driverID, input);
            
            if (!lookupResult) {
                await sock.sendMessage(jid, { text: "Sorry, we could not find a matching driver and vehicle. Please try again." });
                clearSession(jid);
                // Restart optionally
                setSession(jid, { flowType: 'van', step: 'AWAITING_VEHICLE_REG' });
                await sock.sendMessage(jid, { text: "Welcome to the Vehicle Check System. Please enter your Driver ID." });
            } else {
                // Store DB info to session
                setSession(jid, {
                    ...session,
                    vehicleReg: input,
                    driverName: lookupResult.driver_name,
                    branch: lookupResult.branch,
                    vehicleMake: lookupResult.vehicle_make,
                    vehicleModel: lookupResult.vehicle_model,
                    step: 'AWAITING_CONFIRMATION',
                    checklistIndex: 0,
                    checklistResults: []
                });
                
                const confirmMsg = `Vehicle Details: ${lookupResult.vehicle_make} ${lookupResult.vehicle_model}\nDriver Details: ${lookupResult.driver_name} (${lookupResult.branch})\nReply *Y* to confirm or *N* to cancel.`;
                await sock.sendMessage(jid, { text: confirmMsg });
            }
            return true;
        }

        case 'AWAITING_CONFIRMATION':
            if (textLower === 'y' || textLower === 'yes') {
                setSession(jid, { ...session, step: 'CHECKLIST' });
                // Ask first checklist item
                await askNextChecklistItem(sock, jid, getSession(jid));
            } else if (textLower === 'n' || textLower === 'no' || textLower === 'cancel') {
                await sock.sendMessage(jid, { text: "Session cancelled." });
                clearSession(jid);
            } else {
                await sock.sendMessage(jid, { text: "Please reply with Y to confirm or N to cancel." });
            }
            return true;

        case 'CHECKLIST':
            if (textLower === 'cancel') {
                await sock.sendMessage(jid, { text: "Session ended." });
                clearSession(jid);
                return true;
            }

            if (session.awaitingFaultDescription) {
                // Current text is the fault description
                const results = session.checklistResults || [];
                results.push({
                    item: session.currentFaultItem,
                    status: 'FAULT',
                    fault_description: input
                });
                
                // --- SHORT-CIRCUIT LOGIC ---
                // If the first question ("Is the car running?") is failed, stop and submit immediately.
                if (session.checklistIndex === 0) {
                    const finalSession = {
                        ...session,
                        checklistResults: results,
                        comments: `[AUTO-SUBMIT: Car not running] ${input}`
                    };
                    setSession(jid, finalSession);
                    await finalizeSubmission(sock, jid, finalSession);
                    return true;
                }

                // Proceed to next item
                const nextSession = {
                    ...session,
                    checklistResults: results,
                    checklistIndex: session.checklistIndex + 1,
                    awaitingFaultDescription: false,
                    currentFaultItem: null
                };
                setSession(jid, nextSession);
                await askNextChecklistItem(sock, jid, nextSession);
            } else {
                // Awaiting Y/N for current item
                if (textLower === 'y' || textLower === 'yes') {
                    const results = session.checklistResults || [];
                    results.push({
                        item: checklistItems[session.checklistIndex],
                        status: 'OK',
                        fault_description: null
                    });
                     // Proceed to next item
                    const nextSession = {
                        ...session,
                        checklistResults: results,
                        checklistIndex: session.checklistIndex + 1
                    };
                    setSession(jid, nextSession);
                    await askNextChecklistItem(sock, jid, nextSession);
                } else if (textLower === 'n' || textLower === 'no') {
                    setSession(jid, { 
                        ...session, 
                        awaitingFaultDescription: true, 
                        currentFaultItem: checklistItems[session.checklistIndex] 
                    });
                    await sock.sendMessage(jid, { text: "Please describe the fault:" });
                } else {
                    await sock.sendMessage(jid, { text: "Please reply with Y, N, or cancel." });
                    // Re-ask current question
                    const curItem = checklistItems[session.checklistIndex];
                    await sock.sendMessage(jid, { text: `${curItem} in good condition? Reply *Y* for yes or *N* for no, or *cancel* to end the session.` });
                }
            }
            return true;
            
        case 'AWAITING_COMMENTS': {
            // Store comments and move to driver selection
            const finalComments = textLower === 'none' ? '' : input;
            setSession(jid, { ...session, comments: finalComments, step: 'AWAITING_DRIVER_SELECTION' });

            // Fetch all drivers and display numbered list
            let drivers;
            try {
                drivers = await getAllDrivers();
            } catch (err) {
                console.error('Failed to fetch drivers for selection:', err);
                await sock.sendMessage(jid, { text: "Could not load driver list. Please contact an administrator." });
                clearSession(jid);
                return true;
            }

            if (!drivers || drivers.length === 0) {
                await sock.sendMessage(jid, { text: "No drivers found in the system. Please contact an administrator." });
                clearSession(jid);
                return true;
            }

            // Store driver list in session for validation later
            setSession(jid, { ...getSession(jid), driversList: drivers });

            const listLines = drivers.map((d, i) => `${i + 1}. ${d.name} (${d.branch})`).join('\n');
            await sock.sendMessage(jid, {
                text: `👤 *Who is driving today?*\nReply with the number next to the driver's name:\n\n${listLines}`
            });
            return true;
        }

        case 'AWAITING_DRIVER_SELECTION': {
            const drivers = session.driversList || [];
            const choice = parseInt(input, 10);

            if (isNaN(choice) || choice < 1 || choice > drivers.length) {
                await sock.sendMessage(jid, {
                    text: `Please reply with a number between 1 and ${drivers.length}.`
                });
                return true;
            }

            const selectedDriver = drivers[choice - 1];

            // Update session with the selected driver
            const finalSession = {
                ...session,
                driverID:   selectedDriver.id,
                driverName: selectedDriver.name,
                branch:     selectedDriver.branch
            };
            setSession(jid, finalSession);

            await sock.sendMessage(jid, {
                text: `✅ Driver set to *${selectedDriver.name}*. Saving report...`
            });

            await finalizeSubmission(sock, jid, finalSession);
            return true;
        }


        default:
            clearSession(jid);
            return false;
    }
}

module.exports = { startVan, handleVanStep };
