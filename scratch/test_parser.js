const { parseExpenseMessage } = require('../src/vehicle/expenseParser');

const testCases = [
    {
        name: "Perfect Format",
        text: "Expense\nVehicle: ACH4184\nAmount: 55\nDescription: new tyres"
    },
    {
        name: "With spaces and cases",
        text: "expense  \nvehicle:  ADH1234 \n amount: $120.50 \ndescription:  bought some new brake pads"
    },
    {
        name: "Missing Vehicle",
        text: "Expense\nAmount: 55\nDescription: new tyres"
    },
    {
        name: "Nickname formatting",
        text: "Expense\nVehicle: Yellow Container\nAmount: 55\nDescription: new tyres"
    },
    {
        name: "Invalid Amount",
        text: "Expense\nVehicle: ACH4184\nAmount: fifty\nDescription: new tyres"
    },
    {
        name: "Missing Description",
        text: "Expense\nVehicle: ACH4184\nAmount: 55"
    },
    {
        name: "Wrong exact heading",
        text: "My Expense\nVehicle: ACH4184\nAmount: 55\nDescription: new tyres"
    }
];

console.log("--- Testing Local Expense Parser ---\n");

testCases.forEach(tc => {
    console.log(`[TEST] ${tc.name}`);
    const result = parseExpenseMessage(tc.text);
    if (result.success) {
        console.log(`✅ Success | Vehicle: ${result.data.vehicle_registration} | Amount: ${result.data.amount} | Desc: ${result.data.description}`);
    } else {
        console.log(`❌ Failed  | Error message: ${result.error}`);
    }
    console.log("---------------------------------------");
});
