const supabase = require('./supabase');

const SERVICE_INTERVAL_KM = 5000;
const DUE_SOON_THRESHOLD  = 4500;

/**
 * Process km from a route submission.
 * For each vehicle, add reported_distance_km to their km_since_service.
 * Returns array of vehicles that are DUE_SOON or OVERDUE (for alert image).
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

        // 1. Upsert the vehicle_service row (create if not exists)
        const { data: existing } = await supabase
            .from('vehicle_service')
            .select('km_since_service')
            .eq('registration', registration)
            .maybeSingle();

        let newKm;
        if (existing) {
            newKm = parseFloat(existing.km_since_service || 0) + km;
            const { error } = await supabase
                .from('vehicle_service')
                .update({ km_since_service: newKm, updated_at: new Date().toISOString() })
                .eq('registration', registration);
            if (error) { console.error(`Service KM update error for ${registration}:`, error); continue; }
        } else {
            newKm = km;
            const { error } = await supabase
                .from('vehicle_service')
                .insert({ registration, km_since_service: newKm });
            if (error) { console.error(`Service KM insert error for ${registration}:`, error); continue; }
        }

        // 2. Determine status
        let status = null;
        if (newKm >= SERVICE_INTERVAL_KM) {
            status = 'OVERDUE';
        } else if (newKm >= DUE_SOON_THRESHOLD) {
            status = 'DUE_SOON';
        }

        if (!status) continue;

        // 3. Check if we've already alerted this vehicle today
        const { error: alertError } = await supabase
            .from('service_alerts')
            .insert({ registration, alert_date: today, status })
            .onConflict(['registration', 'alert_date'])
            .ignore();

        // If insert succeeded (no conflict), it means we haven't alerted yet today
        // We push regardless and let the caller deduplicate using the conflict flag
        // Actually: insert returns an error if on conflict ignore fires — let's just try insert
        // and if it errors with conflict, skip. If it succeeds, add to alert list.
        if (!alertError) {
            alertVehicles.push({
                registration,
                nickname:    v.nickname,
                make:        v.make,
                km_since_service: newKm,
                status
            });
        }
    }

    return alertVehicles;
}

/**
 * Get service status for all active vehicles.
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
                last_service_date,
                updated_at
            )
        `)
        .eq('is_active', true)
        .order('registration', { ascending: true });

    if (error) throw error;

    return data.map(v => {
        const svc = v.vehicle_service && v.vehicle_service.length > 0 ? v.vehicle_service[0] : null;
        const kmSince = svc ? parseFloat(svc.km_since_service) : 0;
        const kmLeft  = SERVICE_INTERVAL_KM - kmSince;
        let status;
        if (kmSince >= SERVICE_INTERVAL_KM) {
            status = 'OVERDUE';
        } else if (kmSince >= DUE_SOON_THRESHOLD) {
            status = 'DUE_SOON';
        } else {
            status = 'OK';
        }
        return {
            registration: v.registration,
            make:         v.make,
            nickname:     v.nickname,
            km_since_service: kmSince,
            km_left:      kmLeft,
            status,
            last_service_date: svc?.last_service_date || null
        };
    });
}

/**
 * Log a completed service for a vehicle — resets KM counter.
 * @param {string} registration
 */
async function logServiceCompleted(registration) {
    const today = new Date().toISOString().split('T')[0];

    const { data: existing } = await supabase
        .from('vehicle_service')
        .select('id')
        .eq('registration', registration)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('vehicle_service')
            .update({
                km_since_service:  0,
                last_service_date: today,
                updated_at:        new Date().toISOString()
            })
            .eq('registration', registration);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('vehicle_service')
            .insert({ registration, km_since_service: 0, last_service_date: today });
        if (error) throw error;
    }
    return true;
}

module.exports = { processTripKm, getVehicleServiceStatus, logServiceCompleted, SERVICE_INTERVAL_KM, DUE_SOON_THRESHOLD };
