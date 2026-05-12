require('dotenv').config();
const supabase = require('./src/db/supabase');

async function test() {
    try {
        const { data, error } = await supabase
            .from('service_logs')
            .insert([{ registration: 'TEST', odometer_reading: 1000 }])
            .select();
        console.log("Error:", error);
    } catch (e) {
        console.error(e);
    }
}
test();
