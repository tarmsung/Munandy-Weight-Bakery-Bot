const supabase = require('./supabase');

/**
 * Fetch all supervisor phone numbers.
 * @returns {Promise<Array<{phone_number: string}>>}
 */
async function getAllSupervisors() {
    const { data, error } = await supabase
        .from('supervisors')
        .select('phone_number')
        .order('added_at', { ascending: true });

    if (error) throw new Error(`getAllSupervisors: ${error.message}`);
    return data;
}

/**
 * Add a new supervisor.
 * @param {string} phoneNumber 
 */
async function addSupervisor(phoneNumber) {
    const { data, error } = await supabase
        .from('supervisors')
        .insert([{ phone_number: phoneNumber }])
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

module.exports = { getAllSupervisors, addSupervisor, removeSupervisor };
