require('dotenv').config();
const supabase = require('./src/db/supabase');

async function test() {
    try {
        const { data, error } = await supabase
            .from('vehicles')
            .select('*')
            .limit(1);
        console.log("Error:", error);
        console.log("Data:", data);
    } catch (e) {
        console.error(e);
    }
}
test();
