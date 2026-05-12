require('dotenv').config();
const supabase = require('./src/db/supabase');

async function test() {
    try {
        const { data, error } = await supabase.from('vehicle_service').select('*');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
