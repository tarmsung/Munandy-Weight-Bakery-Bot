const supabase = require('./supabase');

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
            .select('*');

        if (error) throw error;

        console.log(`[JC DEBUG] Total job cards in DB: ${data.length}`);

        // Filter by the date written on the job card itself
        const filtered = data.filter(jc => {
            const jobDate = parseDDMMYYYY(jc.job_date);
            if (!jobDate) return false;
            return jobDate >= startDate && jobDate <= endDate;
        });

        console.log(`[JC DEBUG] Job cards in date range (${startDateStr} → ${endDateStr}): ${filtered.length}`);

        // Sort chronologically (DB ordering on DD/MM/YYYY text is alphabetical, not chronological)
        filtered.sort((a, b) => parseDDMMYYYY(a.job_date) - parseDDMMYYYY(b.job_date));

        // Fetch ALL vehicles (active and inactive) to map branch.
        // Using active-only would silently drop job cards for deactivated vehicles.
        // Some job cards were saved with extra text after the registration
        // (e.g. "AHL3922 DUTRO" instead of "AHL3922").  We fall back to
        // matching on the registration prefix (first space-delimited token).
        const { data: allVehicles, error: vErr } = await supabase
            .from('vehicles')
            .select('registration, make, model, nickname, branch, current_mileage');
        if (vErr) throw vErr;

        console.log(`[JC DEBUG] Total vehicles fetched for branch lookup: ${(allVehicles || []).length}`);

        const vehicleMap = {};
        for (const v of (allVehicles || [])) {
            vehicleMap[v.registration] = v;
        }

        // Enrich and filter by branch
        let enrichedData = filtered.map(jc => {
            // Exact match first, then prefix fallback
            const v = vehicleMap[jc.vehicle_registration]
                   || vehicleMap[jc.vehicle_registration.split(' ')[0]];
            const resolvedBranch = v ? v.branch : 'UNKNOWN';
            console.log(`[JC DEBUG] Card reg="${jc.vehicle_registration}" date="${jc.job_date}" → vehicle found=${!!v} branch="${resolvedBranch}"`);
            return {
                ...jc,
                branch: resolvedBranch
            };
        });

        // Case-insensitive branch filter to handle any casing inconsistencies
        if (branch && branch !== 'all') {
            const branchLower = branch.toLowerCase();
            const before = enrichedData.length;
            enrichedData = enrichedData.filter(jc => jc.branch.toLowerCase() === branchLower);
            console.log(`[JC DEBUG] Branch filter "${branch}": ${before} → ${enrichedData.length} cards`);
        }

        console.log(`[JC DEBUG] Final result: ${enrichedData.length} cards returned`);
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
