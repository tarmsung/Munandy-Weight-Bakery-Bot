const supabase = require('./supabase');

async function saveVehicleExpense({ vehicle_registration, amount, currency, description, source_message, reporter_jid }) {
    try {
        const { data, error } = await supabase
            .from('vehicle_expenses')
            .insert([{
                vehicle_registration,
                amount,
                currency: currency || 'USD',
                description,
                expense_date: new Date().toISOString(),
                source_message,
                reporter_jid
            }])
            .select('id')
            .single();

        if (error) {
            console.error('Error saving vehicle expense:', error);
            throw error;
        }
        console.log(`Vehicle expense saved with id: ${data.id}`);
        return data.id;
    } catch (err) {
        console.error('Error in saveVehicleExpense:', err);
        throw err;
    }
}

/**
 * Fetches total expenses for a specific month grouped by vehicle.
 * @param {number} month - 1-12
 * @param {number} year - e.g. 2026
 */
async function getMonthlyExpenses(month, year) {
    // Construct date range
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 1).toISOString();

    try {
        const { data, error } = await supabase
            .from('vehicle_expenses')
            .select('vehicle_registration, amount')
            .gte('expense_date', startDate)
            .lt('expense_date', endDate);

        if (error) throw error;

        // Aggregate by vehicle
        const totals = {};
        for (const row of data) {
            const reg = row.vehicle_registration;
            if (!totals[reg]) totals[reg] = 0;
            totals[reg] += Number(row.amount);
        }

        return totals;
    } catch (err) {
        console.error('Error in getMonthlyExpenses:', err);
        throw err;
    }
}

/**
 * Fetches total distance for a specific month grouped by vehicle from route_reports.
 * @param {number} month - 1-12
 * @param {number} year  - e.g. 2026
 */
async function getMonthlyDistances(month, year) {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 1).toISOString();

    try {
        const { data, error } = await supabase
            .from('route_reports')
            .select('vehicle_routes')
            .gte('submitted_at', startDate)
            .lt('submitted_at', endDate);

        if (error) throw error;

        // Aggregate by vehicle
        const totals = {};
        for (const report of data) {
            const routesArray = report.vehicle_routes || [];
            for (const vehicle of routesArray) {
                const reg = vehicle.registration;
                const distance = Number(vehicle.reported_distance_km) || 0;
                
                if (!totals[reg]) totals[reg] = 0;
                totals[reg] += distance;
            }
        }

        return totals;
    } catch (err) {
        console.error('Error in getMonthlyDistances:', err);
        throw err;
    }
}

module.exports = {
    saveVehicleExpense,
    getMonthlyExpenses,
    getMonthlyDistances
};
