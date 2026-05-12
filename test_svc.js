require('dotenv').config();
const { getVehicleServiceStatus } = require('./src/db/service');

async function test() {
    try {
        const statuses = await getVehicleServiceStatus();
        console.log(JSON.stringify(statuses, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
