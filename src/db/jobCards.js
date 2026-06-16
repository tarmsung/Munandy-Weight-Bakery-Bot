const supabase = require('./supabase');
const { getAllActiveVehicles } = require('./vehicles');

async function saveJobCard({ vehicle_registration, job_date, description, fuel, price, time_out, time_in, driver_job_id, reporter_jid, message_id }) {
    try {
        const { data, error } = await supabase
            .from('job_cards')
            .insert([{
                vehicle_registration,
                job_date,
                description,
                fuel,
                price,
                time_out,
                time_in,
                driver_job_id,
                reporter_jid,
                message_id
            }])
            .select('id')
            .single();

        if (error) {
            console.error('Error saving job card:', error);
            throw error;
        }
        return data.id;
    } catch (err) {
        console.error('Error in saveJobCard:', err);
        throw err;
    }
}

async function deleteJobCardByMessageId(messageId) {
    try {
        const { data, error } = await supabase
            .from('job_cards')
            .delete()
            .eq('message_id', messageId)
            .select('*')
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return null; // No rows deleted
            }
            throw error;
        }
        return data;
    } catch (err) {
        console.error('Error in deleteJobCardByMessageId:', err);
        throw err;
    }
}

/**
 * Fetches Job Cards within a specific date range, enriched with vehicle branch info.
 * @param {string} startDateStr - e.g. 2026-04-01
 * @param {string} endDateStr - e.g. 2026-04-30
 * @param {string} branch - (Optional) Filter by branch code 'MH', 'MM', 'MB' or 'all'
 */
async function getJobCardsByDateRange(startDateStr, endDateStr, branch = null) {
    // We filter using job_date or created_at. However, job_date is TEXT in DD/MM/YYYY.
    // created_at is timestamp. It's safer to filter by created_at.
    const startIso = `${startDateStr}T00:00:00.000Z`;
    const endIso = `${endDateStr}T23:59:59.999Z`;

    try {
        const { data, error } = await supabase
            .from('job_cards')
            .select('*')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Fetch vehicles to map branch
        const vehicles = await getAllActiveVehicles();
        const vehicleMap = {};
        for (const v of vehicles) {
            vehicleMap[v.registration] = v;
        }

        // Enrich and filter by branch
        let enrichedData = data.map(jc => {
            const v = vehicleMap[jc.vehicle_registration];
            return {
                ...jc,
                branch: v ? v.branch : 'UNKNOWN'
            };
        });

        if (branch && branch !== 'all') {
            enrichedData = enrichedData.filter(jc => jc.branch === branch);
        }

        return enrichedData;
    } catch (err) {
        console.error('Error in getJobCardsByDateRange:', err);
        throw err;
    }
}

module.exports = {
    saveJobCard,
    deleteJobCardByMessageId,
    getJobCardsByDateRange
};
