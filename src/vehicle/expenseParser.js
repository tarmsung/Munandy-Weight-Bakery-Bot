/**
 * Parses a strict-format expense message.
 * Expected Format:
 * Expense
 * Vehicle: [Registration]
 * Amount: [Number]
 * Description: [Text]
 * 
 * @param {string} rawMessage The message from WhatsApp 
 * @returns {{success: boolean, data?: {vehicle_registration: string, amount: number, description: string}, error?: string}}
 */
function parseExpenseMessage(rawMessage) {
    const trimmed = rawMessage.trim();
    if (!trimmed.toLowerCase().startsWith('expense')) {
        return { success: false, error: "❌ Invalid format. The message must start with the heading 'Expense'." };
    }

    const lines = trimmed.split('\n');
    const data = {};
    
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;

        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();

        if (key === 'vehicle') data.vehicle_registration = value;
        if (key === 'amount') data.amount_raw = value;
        if (key === 'description') data.description = value;
    }

    // Validation
    if (!data.vehicle_registration) {
        return { success: false, error: "❌ Invalid format. 'Vehicle:' line is missing or empty." };
    }
    
    if (data.vehicle_registration.length > 15) {
         return { success: false, error: `❌ Invalid format. '${data.vehicle_registration}' looks too long for a registration. Please use the exact vehicle reg.` };
    }

    if (!data.amount_raw) {
        return { success: false, error: "❌ Invalid format. 'Amount:' line is missing or empty." };
    }
    
    const amountStr = data.amount_raw.replace(/\$/g, '').replace(/,/g, '').trim();
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
        return { success: false, error: `❌ Invalid format. 'Amount: ${data.amount_raw}' is not a valid number.`};
    }

    if (!data.description) {
        return { success: false, error: "❌ Invalid format. 'Description:' line is missing or empty." };
    }

    return {
        success: true,
        data: {
            vehicle_registration: data.vehicle_registration,
            amount: amount,
            description: data.description
        }
    };
}

module.exports = { parseExpenseMessage };
