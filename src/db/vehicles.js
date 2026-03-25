const supabase = require('./supabase');

async function lookupDriverAndVehicle(driverId, vehicleReg) {
    try {
        const { data: driver, error: driverError } = await supabase
            .from('drivers')
            .select('id, name, branch')
            .eq('id', driverId)
            .single();

        if (driverError || !driver) {
            console.log(`Driver not found: [${driverId}]`);
            return null;
        }

        const { data: vehicle, error: vehicleError } = await supabase
            .from('vehicles')
            .select('registration, make, model')
            .eq('registration', vehicleReg)
            .single();

        if (vehicleError || !vehicle) {
            console.log(`Vehicle not found: [${vehicleReg}]`);
            return null;
        }

        return {
            driver_id:     driver.id,
            driver_name:   driver.name,
            branch:        driver.branch,
            vehicle_reg:   vehicle.registration,
            vehicle_make:  vehicle.make,
            vehicle_model: vehicle.model
        };
    } catch (err) {
        console.error('Error in lookupDriverAndVehicle:', err);
        throw err;
    }
}

async function saveInspectionReport({ driverId, vehicleReg, checklist, comments, reporterJid }) {
    try {
        const { data, error } = await supabase
            .from('inspection_reports')
            .insert([{
                driver_id:            driverId,
                vehicle_registration: vehicleReg,
                submitted_at:         new Date().toISOString(),
                checklist:            checklist,
                comments:             comments || '',
                reporter_jid:         reporterJid
            }])
            .select('id')
            .single();

        if (error) {
            console.error('Error saving inspection report:', error);
            throw error;
        }
        console.log(`Inspection report saved with id: ${data.id}`);
        return data.id;
    } catch (err) {
        console.error('Error in saveInspectionReport:', err);
        throw err;
    }
}

async function getAllActiveVehicles() {
    try {
        const { data, error } = await supabase
            .from('vehicles')
            .select('registration, nickname, make, branch')
            .eq('is_active', true)
            .order('branch', { ascending: true })
            .order('nickname', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error in getAllActiveVehicles:', err);
        throw err;
    }
}

async function getRecentUserReports(jid, type, limit = 5) {
    const table = type === 'van' ? 'inspection_reports' : 'route_reports';
    try {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('reporter_jid', jid)
            .order('submitted_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error(`Error fetching recent ${type} reports:`, err);
        throw err;
    }
}

async function getReportById(id, type) {
    const table = type === 'van' ? 'inspection_reports' : 'route_reports';
    try {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('id', id)
            .single();

        if (error) return null;
        return data;
    } catch (err) {
        console.error(`Error fetching ${type} report ${id}:`, err);
        throw err;
    }
}

async function updateReport(id, type, updateData) {
    const table = type === 'van' ? 'inspection_reports' : 'route_reports';
    try {
        const payload = {
            ...updateData,
            is_edited: true,
            edited_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from(table)
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (err) {
        console.error(`Error updating ${type} report ${id}:`, err);
        throw err;
    }
}

module.exports = {
    lookupDriverAndVehicle,
    saveInspectionReport,
    getAllActiveVehicles,
    getRecentUserReports,
    getReportById,
    updateReport
};
