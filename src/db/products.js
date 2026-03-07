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

/**
 * Add a new product to the database.
 * @param {string} productName 
 * @param {number} minWeight 
 * @param {number} maxWeight 
 */
async function addProduct(productName, minWeight, maxWeight) {
    const { data, error } = await supabase
        .from('products')
        .insert([{
            product_name: productName,
            min_weight: minWeight,
            max_weight: maxWeight
        }])
        .select()
        .single();

    if (error) throw new Error(`addProduct: ${error.message}`);
    return data;
}

/**
 * Update the min/max weight range of a product.
 * @param {number} id 
 * @param {number} minWeight 
 * @param {number} maxWeight 
 */
async function updateProductRange(id, minWeight, maxWeight) {
    const { data, error } = await supabase
        .from('products')
        .update({
            min_weight: minWeight,
            max_weight: maxWeight
        })
        .eq('id', id)
        .select()
        .single();

    if (error) throw new Error(`updateProductRange: ${error.message}`);
    return data;
}

/**
 * Delete a product from the database.
 * @param {number} id 
 */
async function deleteProduct(id) {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) throw new Error(`deleteProduct: ${error.message}`);
    return true;
}

module.exports = { getAllProducts, getProductById, addProduct, updateProductRange, deleteProduct };
