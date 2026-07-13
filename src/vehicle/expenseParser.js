/**
 * Maps common branch name variants → canonical DB name.
 * Case-insensitive — applied to the trimmed lowercase value.
 */
const BRANCH_NORMALISE = {
    'harare': 'Harare', 'hre': 'Harare', 'mh': 'Harare',
    'mutare': 'Mutare',  'mtr': 'Mutare',  'mm': 'Mutare',
    'bulawayo': 'Bulawayo', 'byo': 'Bulawayo', 'mb': 'Bulawayo', 'bul': 'Bulawayo',
};

/**
 * Parses a strict-format expense message.
 * Expected Format:
 * Expense
 * Vehicle: [Registration]
 * Branch: [Location]
 * Amount: [Number]
 * Description: [Text]
 * 
 * @param {string} rawMessage The message from WhatsApp 
 * @returns {{success: boolean, data?: {vehicle_registration: string, branch: string, amount: number, description: string}, error?: string}}
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
        if (key === 'branch') data.branch = value;
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

    if (!data.branch) {
        return { success: false, error: "❌ Invalid format. 'Branch:' line is missing or empty. Use: Harare, Mutare, or Bulawayo." };
    }

    // Normalise branch to canonical full name
    const normalisedBranch = BRANCH_NORMALISE[data.branch.trim().toLowerCase()];
    if (!normalisedBranch) {
        return { success: false, error: `❌ Unknown branch: *${data.branch}*. Please use one of: Harare, Mutare, Bulawayo.` };
    }

    return {
        success: true,
        data: {
            vehicle_registration: data.vehicle_registration,
            amount: amount,
            description: data.description,
            branch: normalisedBranch
        }
    };
}

module.exports = { parseExpenseMessage };
