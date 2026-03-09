require('dotenv').config();
const supabase = require('./src/db/supabase');

async function testConnection() {
    const { data, error } = await supabase
        .from('weight_records')
        .select('id, recorded_at, status, products(product_name)')
        .order('recorded_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log(`✅ Found ${data.length} recent records:`);
        data.forEach(r => {
            console.log(`   - ID: ${r.id} | ${r.products?.product_name} | ${r.status} | Time: ${r.recorded_at}`);
        });
    }
}
testConnection();
