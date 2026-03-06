const supabase = require('./supabase');

/**
 * Save a new weight record to Supabase.
 */
async function saveRecord({ productId, samples, average, quantity, status, variance, recordedBy }) {
    const { data, error } = await supabase
        .from('weight_records')
        .insert([{
            product_id: productId,
            sample1: samples[0],
            sample2: samples[1],
            sample3: samples[2],
            sample4: samples[3],
            average,
            quantity: quantity ?? null,
            status,
            variance,
            recorded_by: recordedBy ?? null,
        }])
        .select()
        .single();

    if (error) throw new Error(`saveRecord: ${error.message}`);
    return data;
}

/**
 * Fetch all weight records for today (server date in UTC, adjust if needed).
 * Joins with the products table to include product details.
 */
async function getTodayRecords() {
    // Supabase stores timestamptz in UTC; filter by UTC date
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data, error } = await supabase
        .from('weight_records')
        .select(`
      *,
      products (
        product_name,
        min_weight,
        max_weight
      )
    `)
        .gte('recorded_at', todayStart.toISOString())
        .lte('recorded_at', todayEnd.toISOString())
        .order('recorded_at', { ascending: true });

    if (error) throw new Error(`getTodayRecords: ${error.message}`);

    // Flatten the joined products object for ease of use
    return (data || []).map((r) => ({
        ...r,
        product_name: r.products?.product_name,
        min_weight: r.products?.min_weight,
        max_weight: r.products?.max_weight,
    }));
}

/**
 * Fetch all weight records for a specific date (YYYY-MM-DD).
 */
async function getRecordsByDate(date) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);

    const { data, error } = await supabase
        .from('weight_records')
        .select(`
      *,
      products (
        product_name,
        min_weight,
        max_weight
      )
    `)
        .gte('recorded_at', start.toISOString())
        .lte('recorded_at', end.toISOString())
        .order('recorded_at', { ascending: true });

    if (error) throw new Error(`getRecordsByDate: ${error.message}`);

    return (data || []).map((r) => ({
        ...r,
        product_name: r.products?.product_name,
        min_weight: r.products?.min_weight,
        max_weight: r.products?.max_weight,
    }));
}

module.exports = { saveRecord, getTodayRecords, getRecordsByDate };
