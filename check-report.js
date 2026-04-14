require('dotenv').config();
const supabase = require('./src/db/supabase');


async function check() {
    console.log('--- Daily Reports (Last 5) ---');
    const { data: reports, error: reportError } = await supabase
        .from('daily_reports')
        .select('*')
        .order('date', { ascending: false })
        .limit(5);
    
    if (reportError) {
        console.error('Error fetching reports:', reportError);
    } else if (reports && reports.length > 0) {
        reports.forEach(r => {
            console.log(`Date: ${r.date} | Sent: ${r.sent} | Sent At: ${r.sent_at}`);
        });
    } else {
        console.log('No entries in daily_reports table.');
    }

    const reportDate = '2026-04-06';
    console.log('\n--- Details for', reportDate, '---');

    // Also check if there are any inspection reports for that date
    const { count, error: countError } = await supabase
        .from('inspection_reports')
        .select('*', { count: 'exact', head: true })
        .gte('submitted_at', `${reportDate}T00:00:00`)
        .lte('submitted_at', `${reportDate}T23:59:59`);
    
    if (countError) {
        console.error('Error counting inspection reports:', countError);
    } else {
        console.log('Inspection reports for', reportDate, ':', count);
    }
}

check();
