const supabase = require('./supabase');

/**
 * Fetch all products ordered by id.
 * @returns {Promise<Array>}
 */
async function getAllProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true });

    if (error) throw new Error(`getAllProducts: ${error.message}`);
    return data;
}

/**
 * Fetch a single product by id.
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
async function getProductById(id) {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw new Error(`getProductById: ${error.message}`);
    return data;
}

module.exports = { getAllProducts, getProductById };
