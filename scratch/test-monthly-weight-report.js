require('dotenv').config();
const { getMonthlyRecords } = require('../src/db/records');
const { analyzeMonthlyWeights } = require('../src/reports/monthlyWeightAnalyzer');
const { generateMonthlyWeightPDF } = require('../src/reports/monthlyWeightPdfGenerator');
const fs = require('fs');
const path = require('path');

async function testMonthlyReport() {
    console.log('--- Testing Monthly Weight Report Logic ---');

    try {
        // Use last month or current month for testing
        const now = new Date();
        const month = now.getMonth() + 1; // current month
        const year = now.getFullYear();
        const monthLabel = now.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });

        console.log(`1. Fetching records for ${monthLabel}...`);
        const records = await getMonthlyRecords(month, year);
        console.log(`   Found ${records.length} records.`);

        if (records.length === 0) {
            console.warn('⚠️ No records found for current month. Testing with empty data summary.');
        }

        console.log('2. Running AI Analysis (Claude)...');
        const results = await analyzeMonthlyWeights(records, monthLabel);
        console.log('   Analysis complete.');
        console.log('\n--- AI NARRATIVE PREVIEW ---');
        console.log(results.analysis);
        console.log('----------------------------\n');

        console.log('3. Generating PDF...');
        const pdfBuffer = await generateMonthlyWeightPDF(results, monthLabel);
        
        const testFilePath = path.join(__dirname, `test_monthly_report_${year}_${month}.pdf`);
        fs.writeFileSync(testFilePath, pdfBuffer);
        
        console.log(`✅ Success! Test PDF generated at: ${testFilePath}`);

    } catch (err) {
        console.error('❌ Test failed:', err);
    }
}

testMonthlyReport();
