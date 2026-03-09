const supabase = require('./supabase');

/**
 * Fetch all supervisor phone numbers, optionally filtered by branch.
 * @param {string} [branch] 
 * @returns {Promise<Array<{phone_number: string, branch: string}>>}
 */
async function getAllSupervisors(branch = null) {
    let query = supabase
        .from('supervisors')
        .select('phone_number, branch')
        .order('added_at', { ascending: true });

    if (branch) {
        query = query.eq('branch', branch);
    }

    const { data, error } = await query;
    if (error) throw new Error(`getAllSupervisors: ${error.message}`);
    return data;
}

/**
 * Add a new supervisor.
 * @param {string} phoneNumber 
 * @param {string} branch
 */
async function addSupervisor(phoneNumber, branch) {
    const { data, error } = await supabase
        .from('supervisors')
        .insert([{ phone_number: phoneNumber, branch }])
        .select()
        .single();

    if (error) {
        if (error.code === '23505') throw new Error('Supervisor already exists'); // Unique violation
        throw new Error(`addSupervisor: ${error.message}`);
    }
    return data;
}

/**
 * Remove a supervisor.
 * @param {string} phoneNumber 
 */
async function removeSupervisor(phoneNumber) {
    const { error } = await supabase
        .from('supervisors')
        .delete()
        .eq('phone_number', phoneNumber);

    if (error) throw new Error(`removeSupervisor: ${error.message}`);
    return true;
}

/**
 * Get branch for a specific supervisor phone number.
 * @param {string} phoneNumber
 * @returns {Promise<string|null>} branch name or null if not found
 */
async function getSupervisorBranch(phoneNumber) {
    const { data, error } = await supabase
        .from('supervisors')
        .select('branch')
        .eq('phone_number', phoneNumber)
        .single();
    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`getSupervisorBranch: ${error.message}`);
    }
    return data?.branch || null;
}

module.exports = { getAllSupervisors, addSupervisor, removeSupervisor, getSupervisorBranch };
