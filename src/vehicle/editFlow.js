/**
 * editFlow.js
 * Handles the logic for editing previously submitted reports.
 */

const db = { ...require('../db/vehicles'), ...require('../db/routes') };
const sessionManager = require('../sessions/sessionManager');
const { handleRouteMessage } = require('./routeFlow');
const reportHelper = require('./report');
const { sendRouteReportToGroup } = require('./routeReport');
const supabase = require('../db/supabase');

/**
 * Main dispatcher for the Edit flow.
 */
async function handleEditMessage(sock, senderJid, text, session) {
    const textLower = text.trim().toLowerCase();
    if (textLower === 'cancel') {
        await sock.sendMessage(senderJid, { text: 'Edit session cancelled.' });
        sessionManager.clearSession(senderJid);
        return;
    }

    switch (session.step) {
        // -------------------------------------------------------
        // STEP 1: Select Type (Van vs Route)
        // -------------------------------------------------------
        case 'EDIT_SELECT_TYPE': {
            let type;
            if (text === '1') type = 'van';
            else if (text === '2') type = 'route';
            else {
                await sock.sendMessage(senderJid, { text: 'Invalid selection. Please reply with 1 for Van or 2 for Route.' });
                return;
            }

            const reports = await db.getRecentUserReports(senderJid, type);
            if (!reports || reports.length === 0) {
                await sock.sendMessage(senderJid, { text: `We couldn't find any recent ${type} reports submitted by you.` });
                sessionManager.clearSession(senderJid);
                return;
            }

            session.editType = type;
            session.recentReports = reports;
            session.step = 'EDIT_SELECT_REPORT';
            sessionManager.updateSession(senderJid, session);

            let msg = `Select the report you want to edit:\n\n`;
            reports.forEach((r, i) => {
                const date = new Date(r.submitted_at).toLocaleString();
                const detail = type === 'van' ? r.vehicle_registration : 'Route Report';
                msg += `${i + 1}. ${date} - ${detail}\n`;
            });
            msg += `\nReply with the number or *cancel*.`;
            await sock.sendMessage(senderJid, { text: msg });
            break;
        }

        // -------------------------------------------------------
        // STEP 2: Select specific report
        // -------------------------------------------------------
        case 'EDIT_SELECT_REPORT': {
            const index = parseInt(text) - 1;
            if (isNaN(index) || index < 0 || index >= session.recentReports.length) {
                await sock.sendMessage(senderJid, { text: `Invalid selection. Please enter a number between 1 and ${session.recentReports.length}.` });
                return;
            }

            const chosen = session.recentReports[index];
            session.editingReportId = chosen.id;
            
            if (session.editType === 'van') {
                // Look up the original report's driver, inspector, and vehicle
                // so the regenerated image has real names instead of IDs.
                try {
                    const driver   = chosen.driver_id   ? await db.getDriverById(chosen.driver_id)   : null;
                    const inspector = chosen.inspector_id ? await db.getDriverById(chosen.inspector_id) : null;
                    const vehicle  = chosen.vehicle_registration ? await db.lookupVehicle(chosen.vehicle_registration) : null;

                    session.driverID        = chosen.driver_id;
                    session.driverName      = driver?.name     || 'Unknown Driver';
                    session.branch          = driver?.branch   || 'N/A';
                    session.inspectorId     = chosen.inspector_id;
                    session.inspectorName   = inspector?.name   || 'Unknown Inspector';
                    session.inspectorBranch = inspector?.branch || 'N/A';
                    session.vehicleReg      = chosen.vehicle_registration;
                    session.vehicleMake     = vehicle?.make    || '';
                    session.vehicleModel    = vehicle?.model   || '';
                    // Carry over existing checklist so edit starts with current state
                    session.checklistResults = chosen.checklist || [];
                    session.comments         = chosen.comments  || '';
                } catch (lookupErr) {
                    console.warn('Could not look up original report data, using defaults.', lookupErr);
                }

                session.step = 'EDIT_VAN_FIELD_SELECT';
                await sock.sendMessage(senderJid, { text: "What would you like to edit?\n1. Entire Checklist\n2. Additional Comments\n\nReply with the number." });
            } else {
                session.step = 'EDIT_ROUTE_START';
                await sock.sendMessage(senderJid, { text: "You are now editing this Route Report. You will be asked to re-enter the routes and distances for all vehicles.\n\nReply *ok* to start." });
            }
            sessionManager.updateSession(senderJid, session);
            break;
        }

        // -------------------------------------------------------
        // VAN EDIT SUB-FLOW
        // -------------------------------------------------------
        case 'EDIT_VAN_FIELD_SELECT': {
            if (text === '1') {
                // Re-run full checklist
                // We'll reset the session to look like a Van flow but with isEditing flag
                session.flowType = 'van'; // Hand back to vanHandler
                session.step = 'CHECKLIST';
                session.checklistIndex = 0;
                session.checklistResults = [];
                session.awaitingFaultDescription = false;
                session.isEditing = true;
                sessionManager.updateSession(senderJid, session);

                await sock.sendMessage(senderJid, { text: "(Editing) Let's re-run the checklist. Oil level in good condition? Reply Y/N." });
            } else if (text === '2') {
                session.step = 'EDIT_VAN_COMMENTS';
                await sock.sendMessage(senderJid, { text: "Please enter the corrected comments:" });
            } else {
                await sock.sendMessage(senderJid, { text: "Invalid choice. Reply 1 or 2." });
            }
            sessionManager.updateSession(senderJid, session);
            break;
        }

        case 'EDIT_VAN_COMMENTS': {
            const updated = await db.updateReport(session.editingReportId, 'van', { comments: text });
            
            // Build a full session-like payload using names already stored in session
            const reportPayload = {
                driverName:      session.driverName      || 'Unknown Driver',
                branch:          session.branch          || 'N/A',
                inspectorName:   session.inspectorName   || 'Unknown Inspector',
                inspectorBranch: session.inspectorBranch || 'N/A',
                vehicleReg:      updated.vehicle_registration,
                vehicleMake:     session.vehicleMake     || '',
                vehicleModel:    session.vehicleModel    || '',
                checklistResults: updated.checklist      || session.checklistResults || [],
                comments:        updated.comments,
                isEdited:        true
            };
            await reportHelper.sendReportToGroup(sock, reportPayload);
            
            await sock.sendMessage(senderJid, { text: "Comments updated successfully and group notified. ✅" });
            sessionManager.clearSession(senderJid);
            break;
        }

        // -------------------------------------------------------
        // ROUTE EDIT SUB-FLOW
        // -------------------------------------------------------
        case 'EDIT_ROUTE_START': {
            if (textLower === 'ok') {
                // Initialize a route-like session inside the edit session
                // We'll reuse handleRouteMessage by changing the flow type temporarily
                const activeVehicles = await db.getAllActiveVehicles();
                session.flowType = 'route';
                session.step = 'ROUTE_AWAIT_ROUTE';
                session.vehicles = activeVehicles;
                session.currentVehicleIndex = 0;
                session.vehicleRoutes = [];
                session.isEditing = true; // Flag for finalization
                
                sessionManager.updateSession(senderJid, session);
                
                // Trigger the first route question
                const vehicle = activeVehicles[0];
                await sock.sendMessage(senderJid, { text: `(Editing) For *${vehicle.make} ${vehicle.nickname}*... which route(s)?` });
            } else {
                await sock.sendMessage(senderJid, { text: "Reply *ok* to start editing." });
            }
            break;
        }

        default:
            sessionManager.clearSession(senderJid);
            break;
    }
}

module.exports = { handleEditMessage };
