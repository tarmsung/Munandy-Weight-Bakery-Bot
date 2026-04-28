require('dotenv').config();
const supabase = require('../src/db/supabase');

async function checkExpenses() {
    console.log('--- Recent Vehicle Expenses ---');
    try {
        const { data, error } = await supabase
            .from('vehicle_expenses')
            .select('*')
            .order('expense_date', { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error fetching expenses:', error);
            return;
        }

        if (data.length === 0) {
            console.log('No expenses found in database.');
        } else {
            console.table(data.map(exp => ({
                Date: exp.expense_date,
                Vehicle: exp.vehicle_registration,
                Amount: `$${exp.amount}`,
                Description: exp.description,
                Reporter: exp.reporter_jid ? exp.reporter_jid.split('@')[0] : 'N/A'
            })));
        }

        console.log('\n--- Monthly Totals (Current Month) ---');
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        
        const { data: monthlyData, error: monthlyError } = await supabase
            .from('vehicle_expenses')
            .select('vehicle_registration, amount')
            .gte('expense_date', startOfMonth);

        if (monthlyError) {
            console.error('Error fetching monthly data:', monthlyError);
            return;
        }

        const totals = {};
        monthlyData.forEach(row => {
            const reg = row.vehicle_registration;
            if (!totals[reg]) totals[reg] = 0;
            totals[reg] += Number(row.amount);
        });

        console.table(Object.keys(totals).map(reg => ({
            Vehicle: reg,
            Total: `$${totals[reg].toFixed(2)}`
        })));
    } catch (err) {
        console.error('Script execution failed:', err);
    }
}

checkExpenses();
