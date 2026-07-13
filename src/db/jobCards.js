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
 * Parses a DD/MM/YYYY string into a Date object (midnight UTC).
 * Returns null if the string is missing or unparseable.
 */
function parseDDMMYYYY(str) {
    if (!str) return null;
    const parts = str.trim().split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    if (!day || !month || !year) return null;
    return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Fetches Job Cards within a specific date range, enriched with vehicle branch info.
 * Filters by the job_date field on the card (DD/MM/YYYY), NOT the submission timestamp.
 * @param {string} startDateStr - e.g. 2026-04-01 (YYYY-MM-DD)
 * @param {string} endDateStr   - e.g. 2026-04-30 (YYYY-MM-DD)
 * @param {string|null} branch  - Optional branch name: 'Harare', 'Mutare', 'Bulawayo', or null/'all'
 */
async function getJobCardsByDateRange(startDateStr, endDateStr, branch = null) {
    // Parse range boundaries (YYYY-MM-DD → Date at midnight UTC)
    const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDate   = new Date(`${endDateStr}T23:59:59.999Z`);

    try {
        // Fetch all job cards — we filter by job_date in JS because it is stored
        // as DD/MM/YYYY text, which cannot be reliably range-queried in Postgres.
        const { data, error } = await supabase
            .from('job_cards')
            .select('*')
            .order('job_date', { ascending: true });

        if (error) throw error;

        // Filter by the date written on the job card itself
        const filtered = data.filter(jc => {
            const jobDate = parseDDMMYYYY(jc.job_date);
            if (!jobDate) return false;
            return jobDate >= startDate && jobDate <= endDate;
        });

        // Fetch vehicles to map branch.
        // Some job cards were saved with extra text after the registration
        // (e.g. "AHL3922 DUTRO" instead of "AHL3922").  We fall back to
        // matching on the registration prefix (first space-delimited token).
        const vehicles = await getAllActiveVehicles();
        const vehicleMap = {};
        for (const v of vehicles) {
            vehicleMap[v.registration] = v;
        }

        // Enrich and filter by branch
        let enrichedData = filtered.map(jc => {
            // Exact match first, then prefix fallback
            const v = vehicleMap[jc.vehicle_registration]
                   || vehicleMap[jc.vehicle_registration.split(' ')[0]];
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
