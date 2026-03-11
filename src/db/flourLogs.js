const supabase = require('./supabase');

/**
 * Save the daily flour usage log for a branch.
 */
async function saveFlourLog({ branch, flourKg, recordedBy }) {
    const { data, error } = await supabase
        .from('daily_flour_logs')
        .insert([{
            branch,
            flour_kg: flourKg,
            recorded_by: recordedBy ?? null,
        }])
        .select()
        .single();

    if (error) throw new Error(`saveFlourLog: ${error.message}`);
    return data;
}

module.exports = { saveFlourLog };
