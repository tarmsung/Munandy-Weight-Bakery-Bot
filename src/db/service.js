const supabase = require('./supabase');

const SERVICE_INTERVAL_KM = 5000;
const DUE_SOON_BUFFER_KM  = 500;   // Alert when ≤ 500 km remaining

/**
 * Process km from a route submission.
 * For each vehicle, add reported_distance_km to their km_since_service.
 * Alerts fire when km_left <= 500 (DUE_SOON) or km_left <= 0 (OVERDUE).
 * One alert per vehicle per day is enforced via service_alerts table.
 * @param {Array} vehicleRoutes - The vehicle_routes array from the route report
 * @returns {Promise<Array>} alertVehicles
 */
async function processTripKm(vehicleRoutes) {
    const alertVehicles = [];
    const today = new Date().toISOString().split('T')[0];

    for (const v of vehicleRoutes) {
        const km = parseFloat(v.reported_distance_km) || 0;
        if (km <= 0) continue;

        const registration = v.registration;

        // 1. Fetch existing service row (we need service_due_at_km too)
        const { data: existing } = await supabase
            .from('vehicle_service')
            .select('km_since_service, service_due_at_km')
            .eq('registration', registration)
            .maybeSingle();

        let newKm;
        let serviceDueAtKm;

        if (existing) {
            newKm         = parseFloat(existing.km_since_service || 0) + km;
            serviceDueAtKm = parseFloat(existing.service_due_at_km || SERVICE_INTERVAL_KM);

            const { error } = await supabase
                .from('vehicle_service')
                .update({ km_since_service: newKm, updated_at: new Date().toISOString() })
                .eq('registration', registration);
            if (error) { console.error(`Service KM update error for ${registration}:`, error); continue; }
        } else {
            newKm          = km;
            serviceDueAtKm = SERVICE_INTERVAL_KM;

            const { error } = await supabase
                .from('vehicle_service')
                .insert({ registration, km_since_service: newKm, service_due_at_km: serviceDueAtKm });
            if (error) { console.error(`Service KM insert error for ${registration}:`, error); continue; }
        }

        // 2. Determine status against the vehicle's own dynamic threshold
        const kmLeft = serviceDueAtKm - newKm;
        let status = null;
        if (kmLeft <= 0) {
            status = 'OVERDUE';
        } else if (kmLeft <= DUE_SOON_BUFFER_KM) {
            status = 'DUE_SOON';
        }

        if (!status) continue;

        // 3. Enforce once-per-day alert via service_alerts table
        const { error: alertError } = await supabase
            .from('service_alerts')
            .upsert(
                { registration, alert_date: today, status },
                { onConflict: 'registration, alert_date', ignoreDuplicates: true }
            );

        if (!alertError) {
            alertVehicles.push({
                registration,
                nickname:         v.nickname,
                make:             v.make,
                km_since_service: newKm,
                service_due_at_km: serviceDueAtKm,
                km_left:          kmLeft,
                status
            });
        }
    }

    return alertVehicles;
}

/**
 * Get service status for all active vehicles.
 * Uses each vehicle's own service_due_at_km for accurate km_left calculation.
 * @returns {Promise<Array>}
 */
async function getVehicleServiceStatus() {
    const { data, error } = await supabase
        .from('vehicles')
        .select(`
            registration,
            make,
            nickname,
            vehicle_service (
                km_since_service,
                service_due_at_km,
                last_service_date,
                updated_at
            )
        `)
        .eq('is_active', true)
        .order('registration', { ascending: true });

    if (error) throw error;

    return data.map(v => {
        const svc = v.vehicle_service && v.vehicle_service.length > 0 ? v.vehicle_service[0] : null;
        const kmSince      = svc ? parseFloat(svc.km_since_service)  : 0;
        const dueAtKm      = svc ? parseFloat(svc.service_due_at_km) : SERVICE_INTERVAL_KM;
        const kmLeft       = dueAtKm - kmSince;

        let status;
        if (kmLeft <= 0) {
            status = 'OVERDUE';
        } else if (kmLeft <= DUE_SOON_BUFFER_KM) {
            status = 'DUE_SOON';
        } else {
            status = 'OK';
        }

        return {
            registration:       v.registration,
            make:               v.make,
            nickname:           v.nickname,
            km_since_service:   kmSince,
            service_due_at_km:  dueAtKm,
            km_left:            kmLeft,
            status,
            last_service_date:  svc?.last_service_date || null
        };
    });
}

/**
 * Log a completed service for a vehicle.
 *
 * Carry-over logic:
 *   - If serviced EARLY (km_since_service < service_due_at_km):
 *       Remaining km are credited → next service due at 5000 + remaining
 *   - If serviced ON TIME or LATE (km_since_service >= service_due_at_km):
 *       Standard reset → next service due at 5000
 *
 * In both cases, km_since_service is reset to 0.
 *
 * @param {string} registration
 */
async function logServiceCompleted(registration) {
    const today = new Date().toISOString().split('T')[0];

    // Fetch current state to calculate carry-over
    const { data: existing } = await supabase
        .from('vehicle_service')
        .select('id, km_since_service, service_due_at_km')
        .eq('registration', registration)
        .maybeSingle();

    let nextDueAtKm = SERVICE_INTERVAL_KM; // default: no carry-over

    if (existing) {
        const kmSince  = parseFloat(existing.km_since_service  || 0);
        const dueAtKm  = parseFloat(existing.service_due_at_km || SERVICE_INTERVAL_KM);
        const remaining = dueAtKm - kmSince;

        if (remaining > 0) {
            // Vehicle was serviced before it was due — credit the unused km
            nextDueAtKm = SERVICE_INTERVAL_KM + remaining;
            console.log(`[Service] ${registration} serviced early. Remaining: ${remaining.toFixed(0)} km → next due at ${nextDueAtKm.toFixed(0)} km`);
        } else {
            // On time or overdue — standard 5000 km reset
            nextDueAtKm = SERVICE_INTERVAL_KM;
            console.log(`[Service] ${registration} serviced on time/late. Standard reset to ${SERVICE_INTERVAL_KM} km.`);
        }

        const { error } = await supabase
            .from('vehicle_service')
            .update({
                km_since_service:  0,
                service_due_at_km: nextDueAtKm,
                last_service_date: today,
                updated_at:        new Date().toISOString()
            })
            .eq('registration', registration);
        if (error) throw error;
    } else {
        // No existing row — create fresh
        const { error } = await supabase
            .from('vehicle_service')
            .insert({
                registration,
                km_since_service:  0,
                service_due_at_km: SERVICE_INTERVAL_KM,
                last_service_date: today
            });
        if (error) throw error;
    }

    return { nextDueAtKm };
}

module.exports = {
    processTripKm,
    getVehicleServiceStatus,
    logServiceCompleted,
    SERVICE_INTERVAL_KM,
    DUE_SOON_BUFFER_KM
};
