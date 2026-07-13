const fs = require('fs');
const { generateJobCardImageReport } = require('./src/reports/jobCardImageGenerator.js');

const mockJobCards = [
    {
        branch: 'Harare',
        vehicle_registration: 'AFT4319',
        description: 'Fixed broken mirror',
        job_date: '2026-06-30',
        driver_job_id: 'JD12',
        fuel: '50L',
        time_out: '08:00',
        time_in: '17:00',
        price: '150.00'
    },
    {
        branch: 'Harare',
        vehicle_registration: 'AFT4319',
        description: 'Oil change',
        job_date: '2026-06-29',
        driver_job_id: 'JD12',
        fuel: '0L',
        time_out: '10:00',
        time_in: '12:00',
        price: '45.50'
    },
    {
        branch: 'Mutare',
        vehicle_registration: 'BGE1022',
        description: 'Tire replacement',
        job_date: '2026-06-28',
        driver_job_id: 'SM45',
        fuel: 'N/A',
        time_out: '09:00',
        time_in: '11:00',
        price: '300.00'
    },
    {
        branch: 'Bulawayo',
        vehicle_registration: 'AES6291',
        description: 'Engine service',
        job_date: '2026-06-27',
        driver_job_id: 'BW01',
        fuel: '30L',
        time_out: '07:30',
        time_in: '15:00',
        price: '220.00'
    }
];

async function run() {
    try {
        const imageBuffer = await generateJobCardImageReport(
            mockJobCards,
            '2026-06-01',
            '2026-06-30',
            715.50,
            'All Branches'
        );
        const outputPath = 'job_card_preview.png';
        fs.writeFileSync(outputPath, imageBuffer);
        console.log('Preview generated:', outputPath);
        process.exit(0);
    } catch (err) {
        console.error('Error generating preview:', err);
        process.exit(1);
    }
}

run();
