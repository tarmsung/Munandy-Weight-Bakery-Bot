const { buildReportHTML } = require('../src/vehicle/report');

const mockSession = {
    driverName: 'John Doe',
    branch: 'HARARE MAIN',
    vehicleMake: 'Toyota',
    vehicleModel: 'Hilux',
    vehicleReg: 'ACZ-1234',
    inspectorName: 'Jane Smith',
    inspectorBranch: 'HARARE KWEKWE',
    checklistResults: [
        { item: 'Tyres', status: 'OK' },
        { item: 'Oil', status: 'FAULT', fault_description: 'Low oil' }
    ],
    comments: 'Just needs an oil top up.',
    isEdited: false
};

const html = buildReportHTML(mockSession);
if (html.includes('Jane Smith') && html.includes('John Doe') && html.includes('Toyota')) {
    console.log('SUCCESS: HTML generated with mock details!');
} else {
    console.error('FAILED: Details missing from HTML!', html);
}
