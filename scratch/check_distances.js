require('dotenv').config();
const supabase = require('../src/db/supabase');

async function checkDistances() {
    console.log('--- Recent Route Distances ---');
    try {
        const { data, error } = await supabase
            .from('route_reports')
            .select('*')
            .order('submitted_at', { ascending: false })
            .limit(5);

        if (error) {
            console.error('Error fetching distances:', error);
            return;
        }

        if (data.length === 0) {
            console.log('No route reports found.');
        } else {
            data.forEach(report => {
                console.log(`[${report.submitted_at}] Routes: ${JSON.stringify(report.vehicle_routes)}`);
            });
        }
    } catch (err) {
        console.error('Script failed:', err);
    }
}

checkDistances();
