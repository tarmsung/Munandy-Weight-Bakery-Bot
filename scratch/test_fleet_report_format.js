const { buildFleetReportMessage } = require('../src/vehicle/reportBuilder');

const mockData = {
    unfiled: [
        { make: 'Nissan', nickname: 'NP200-1', registration: 'ABC-1234' },
        { make: 'Toyota', nickname: 'Dyna-1', registration: 'XYZ-9012' }
    ],
    faults: [
        { make: 'Toyota', nickname: 'Hilux-A', registration: 'HV-88', item: 'Brake Fluid', description: 'Very low', driver_name: 'Driver 1' },
        { make: 'Nissan', nickname: 'NP300', registration: 'NN-22', item: 'Tyre Pressure', description: 'Flat rear left', driver_name: 'Driver 2' }
    ],
    streaks: [
        { make: 'Toyota', nickname: 'Hilux-B', registration: 'HB-99', item: 'Oil', streak: 4, firstDate: '2026-04-16' }
    ],
    resolved: [
        { make: 'Nissan', nickname: 'NP200-2', registration: 'NP-10', item: 'Brake Lights' }
    ],
    maintenance: [
        { make: 'Toyota', nickname: 'Hilux-A', registration: 'HV-88', type: 'Service', date: '2026-04-25' }
    ],
    insurance: [
        { make: 'Nissan', nickname: 'NP300', registration: 'NN-22', date: '2026-04-28' }
    ],
    wellPerforming: [
        { make: 'Toyota', nickname: 'Dyna-2', registration: 'DT-55', driver_name: 'Driver 3' }
    ],
    suggestions: "1. Ground HV-88 immediately for brake fluid leak.\n\n2. Schedule NP300 for tyre repair.\n\n3. HB-99 oil issue is critical and overdue.\n\n4. Driver 3 is recognized for clean submission.\n\n5. Renew insurance for NN-22 immediately."
};

const reportDate = '2026-04-20';
const message = buildFleetReportMessage(mockData, reportDate);

console.log("=== GENERATED FLEET REPORT ===");
console.log(message);
console.log("=== END OF REPORT ===");

if (message.includes('Hello, I am the Munandy Bakery AI Agent.')) {
    console.log('PASS: Header included');
} else {
    console.error('FAIL: Header missing');
}

if (message.includes('*MONDAY, 20 APRIL 2026*')) {
    console.log('PASS: Date format correct');
} else {
    console.error('FAIL: Date format incorrect');
}

if (message.includes('*2. Vehicles with critical challenges ⚠️*')) {
    console.log('PASS: Section 2 title and emoji correct');
} else {
    console.error('FAIL: Section 2 title/emoji mismatch');
}
