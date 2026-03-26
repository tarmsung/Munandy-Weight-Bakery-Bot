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
            .select('registration, make, model, nickname, branch')
            .eq('is_active', true)
            .order('registration', { ascending: true });

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

async function addDriver(id, name, branch) {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .insert([{ id, name, branch }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') throw new Error('Driver ID already exists');
            throw error;
        }
        return data;
    } catch (err) {
        console.error('Error in addDriver:', err);
        throw err;
    }
}

async function deleteDriver(id) {
    try {
        const { error } = await supabase
            .from('drivers')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Error in deleteDriver:', err);
        throw err;
    }
}

async function getAllDrivers() {
    try {
        const { data, error } = await supabase
            .from('drivers')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('Error in getAllDrivers:', err);
        throw err;
    }
}

async function addVehicle({ registration, make, model, nickname, branch }) {
    try {
        const { data, error } = await supabase
            .from('vehicles')
            .insert([{ registration, make, model, nickname, branch, is_active: true }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') throw new Error('Vehicle registration already exists');
            throw error;
        }
        return data;
    } catch (err) {
        console.error('Error in addVehicle:', err);
        throw err;
    }
}

async function deleteVehicle(registration) {
    try {
        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('registration', registration);

        if (error) throw error;
        return true;
    } catch (err) {
        console.error('Error in deleteVehicle:', err);
        throw err;
    }
}

module.exports = {
    lookupDriverAndVehicle,
    saveInspectionReport,
    getAllActiveVehicles,
    getRecentUserReports,
    getReportById,
    updateReport,
    addDriver,
    deleteDriver,
    getAllDrivers,
    addVehicle,
    deleteVehicle
};
