require('dotenv').config();
const supabase = require('./src/db/supabase');

async function run() {
    const { data, error } = await supabase.from('inspection_reports').select('*').limit(1);
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Record Keys:', Object.keys(data[0] || {}));
    console.log('Full Record:', JSON.stringify(data[0], null, 2));
}

run();
