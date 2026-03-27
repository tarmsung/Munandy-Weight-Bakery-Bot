const supabase = require('./supabase');

/**
 * Get all vehicles with their current insurance record.
 * Vehicles without insurance will have null insurance fields.
 * @returns {Promise<Array>}
 */
async function getAllInsuranceStatus() {
    const { data, error } = await supabase
        .from('vehicles')
        .select(`
            registration,
            make,
            nickname,
            branch,
            vehicle_insurance (
                insurance_due,
                policy_number,
                last_updated
            )
        `)
        .eq('is_active', true)
        .order('registration', { ascending: true });

    if (error) throw error;
    return data;
}

/**
 * Add or update insurance details for a vehicle.
 * Uses upsert so it works for both new and existing records.
 * @param {string} registration
 * @param {string} insuranceDue - Date string YYYY-MM-DD
 * @param {string} policyNumber
 * @returns {Promise<Object>}
 */
async function upsertInsurance(registration, insuranceDue, policyNumber) {
    // Check if record already exists
    const { data: existing } = await supabase
        .from('vehicle_insurance')
        .select('id')
        .eq('registration', registration)
        .maybeSingle();

    if (existing) {
        const { data, error } = await supabase
            .from('vehicle_insurance')
            .update({
                insurance_due:  insuranceDue,
                policy_number:  policyNumber,
                last_updated:   new Date().toISOString()
            })
            .eq('registration', registration)
            .select()
            .single();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await supabase
            .from('vehicle_insurance')
            .insert({
                registration,
                insurance_due:  insuranceDue,
                policy_number:  policyNumber
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    }
}

module.exports = { getAllInsuranceStatus, upsertInsurance };
