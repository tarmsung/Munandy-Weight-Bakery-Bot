const { supabase } = require('./supabase');

/**
 * Get a global setting value by key.
 */
async function getSetting(key, defaultValue = null) {
    const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            // Row not found
            return defaultValue;
        }
        console.error(`getSetting error for ${key}:`, error.message);
        return defaultValue;
    }

    return data ? data.value : defaultValue;
}

/**
 * Update or insert a global setting.
 */
async function updateSetting(key, value) {
    const { error } = await supabase
        .from('settings')
        .upsert([{ key, value }]);

    if (error) {
        throw new Error(`updateSetting error: ${error.message}`);
    }
}

module.exports = { getSetting, updateSetting };
