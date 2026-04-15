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
    if (!rawMessage.trim().toLowerCase().startsWith('expense')) {
        return { success: false, error: "❌ Invalid format. The message must start with the heading 'Expense'." };
    }

    const vehicleMatch = rawMessage.match(/vehicle:\s*(.+)/i);
    if (!vehicleMatch || !vehicleMatch[1].trim()) {
        return { success: false, error: "❌ Invalid format. 'Vehicle:' line is missing or empty." };
    }
    
    // Replace any extra spaces or tabs.
    const vehicleReg = vehicleMatch[1].trim();
    // Enforce basic registration length to reject typical nicknames (e.g. "Yellow Container")
    if (vehicleReg.length > 10) {
         return { success: false, error: `❌ Invalid format. '${vehicleReg}' looks like a nickname. Please use the exact vehicle registration.` };
    }

    const amountMatch = rawMessage.match(/amount:\s*(.+)/i);
    if (!amountMatch || !amountMatch[1].trim()) {
        return { success: false, error: "❌ Invalid format. 'Amount:' line is missing or empty." };
    }
    
    // Extract the amount string, remove $ and any commas.
    const amountStr = amountMatch[1].replace(/\$/g, '').replace(/,/g, '').trim();
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) {
        return { success: false, error: `❌ Invalid format. 'Amount:' could not be parsed as a valid run-time number. We received: ${amountMatch[1].trim()}`};
    }

    // Because description typically comes last, we'll match everything after it.
    const descMatch = rawMessage.match(/description:\s*([\s\S]+)/i);
    if (!descMatch || !descMatch[1].trim()) {
        return { success: false, error: "❌ Invalid format. 'Description:' line is missing or empty." };
    }
    const description = descMatch[1].trim();

    return {
        success: true,
        data: {
            vehicle_registration: vehicleReg,
            amount: amount,
            description: description
        }
    };
}

module.exports = { parseExpenseMessage };
