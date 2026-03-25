require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const fs = require('fs');
const path = require('path');

async function runDiagnostics() {
    let output = '🔍 Checking Supabase tables...\n';

    const tables = ['products', 'supervisors', 'weight_records', 'drivers', 'vehicles', 'routes'];

    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                output += `❌ Table [${table}]: Error - ${error.message}\n`;
            } else {
                output += `✅ Table [${table}]: ${count} rows found.\n`;
            }
        } catch (err) {
            output += `💥 Table [${table}]: Unexpected error - ${err.message}\n`;
        }
    }

    output += '\n🔍 Checking sample data for weight flow...\n';
    const { data: prods } = await supabase.from('products').select('*').limit(3);
    if (prods && prods.length > 0) {
       prods.forEach(p => output += `👉 Product: ${p.product_name} (ID: ${p.id}, Range: ${p.min_weight}-${p.max_weight})\n`);
    }
    
    const { data: sups } = await supabase.from('supervisors').select('*');
    if (sups && sups.length > 0) {
        sups.forEach(s => output += `👉 Supervisor: ${s.phone_number} (Branch: ${s.branch})\n`);
    }

    fs.writeFileSync('diag_results.txt', output, 'utf8');
    console.log('✅ Diagnostics written to diag_results.txt');
}



runDiagnostics();
