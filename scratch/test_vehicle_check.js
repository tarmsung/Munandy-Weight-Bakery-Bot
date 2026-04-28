require('dotenv').config();
const { getVehicle } = require('../src/db/vehicles');

async function testCheck() {
    console.log("--- Testing Vehicle DB Verification ---");
    
    const valid = 'ACH4184';
    const fake = 'FAKE1234';

    const validRes = await getVehicle(valid);
    console.log(`Check for ${valid}:`, validRes ? "✅ Found" : "❌ Not Found");

    const fakeRes = await getVehicle(fake);
    console.log(`Check for ${fake}:`, fakeRes ? "✅ Found" : "❌ Not Found");
}

testCheck();
