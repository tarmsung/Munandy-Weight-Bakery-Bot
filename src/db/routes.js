const supabase = require('./supabase');

async function getRouteReporter(phoneNumber) {
    try {
        const { data, error } = await supabase
            .from('route_reporters')
            .select('driver_id, phone_number, name')
            .eq('phone_number', phoneNumber)
            .single();

        if (error || !data) return null;
        return data;
    } catch (err) {
        console.error('Error in getRouteReporter:', err);
        throw err;
    }
}

async function getDriverById(driverId) {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select('id, name, branch')
            .eq('id', driverId)
            .single();

        if (error || !data) return null;
        return data;
    } catch (err) {
        console.error('Error in getDriverById:', err);
        throw err;
    }
}

async function getAllRoutes() {
    try {
        const { data, error } = await supabase
            .from('routes')
            .select('id, name, branch')
            .order('branch', { ascending: true })
            .order('id', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error in getAllRoutes:', err);
        throw err;
    }
}

async function saveRouteReport(driverId, vehicleRoutes, reporterJid) {
    try {
        const { data, error } = await supabase
            .from('route_reports')
            .insert([{
                driver_id:      driverId,
                submitted_at:   new Date().toISOString(),
                vehicle_routes: vehicleRoutes,
                reporter_jid:   reporterJid
            }])
            .select('id')
            .single();

        if (error) {
            console.error('Error saving route report:', error);
            throw error;
        }
        console.log(`Route report saved with id: ${data.id}`);
        return data.id;
    } catch (err) {
        console.error('Error in saveRouteReport:', err);
        throw err;
    }
}

module.exports = {
    getRouteReporter,
    getDriverById,
    getAllRoutes,
    saveRouteReport
};
