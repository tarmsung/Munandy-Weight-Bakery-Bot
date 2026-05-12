require('dotenv').config();
const supabase = require('./src/db/supabase');

async function test() {
    try {
        const { data, error } = await supabase
        .from('vehicles')
        .select(`
            registration,
            make,
            nickname,
            vehicle_service (
                km_since_service,
                service_due_at_km,
                last_service_date,
                updated_at
            )
        `)
        .eq('is_active', true)
        .order('registration', { ascending: true });
        
        console.log(JSON.stringify(data[0], null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
