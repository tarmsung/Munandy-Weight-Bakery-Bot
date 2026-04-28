require('dotenv').config();
const supabase = require('../src/db/supabase');

async function getExpenseSchema() {
    const { data, error } = await supabase
        .from('vehicle_expenses')
        .select('*')
        .limit(1);
    
    if (error) console.error(error);
    else console.log(Object.keys(data[0] || {}));
}

getExpenseSchema();
