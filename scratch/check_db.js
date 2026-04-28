require('dotenv').config();
const { getRecentExpenses } = require('../src/db/expenses');

async function checkRecent() {
    try {
        const expenses = await getRecentExpenses(5);
        console.log("Recent Expenses:");
        expenses.forEach(e => {
            console.log(`- ID: ${e.id} | Vehicle: "${e.vehicle_registration}" | Amount: ${e.amount} | Source: "${e.source_message.replace(/\n/g, '\\n')}"`);
        });
    } catch (err) {
        console.error("Error:", err);
    }
}

checkRecent();
