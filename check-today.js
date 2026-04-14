require('dotenv').config();
const supabase = require('./src/db/supabase');

async function run() {
    const { data, error } = await supabase.from('inspection_reports')
        .select('submitted_at, vehicle_registration')
        .gte('submitted_at', '2026-04-07T00:00:00')
        .lte('submitted_at', '2026-04-07T23:59:59')
        .order('submitted_at', { ascending: true });
    
    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('Total reports for April 7:', data.length);
    data.forEach(r => {
        console.log(`${r.submitted_at} | ${r.vehicle_registration}`);
    });
}

run();
