require('dotenv').config();
const { extractExpenseData } = require('../src/vehicle/expenseExtraction');

async function testExtraction() {
    const testCases = [
        "Paid brakelights expense for ACH4184, $50",
        "Expense\nBought new tyres $450 for ACH4184",
        "ADH 1234 $20 for fuel", // No keyword
        "White Sprinter $100 service" // Nickname + no keyword
    ];

    console.log("--- Testing Vehicle Expense Extraction ---\n");

    for (const text of testCases) {
        console.log(`Input: "${text.replace(/\n/g, '\\n')}"`);
        try {
            const data = await extractExpenseData(text);
            if (data) {
                console.log(`✅ Extracted: Vehicle: ${data.vehicle_registration}, Amount: ${data.amount}, Desc: ${data.description}`);
            } else {
                console.log(`❌ Failed to extract.`);
            }
        } catch (err) {
            console.error(`💥 Error: ${err.message}`);
        }
        console.log("-----------------------------------------");
    }
}

testExtraction();
