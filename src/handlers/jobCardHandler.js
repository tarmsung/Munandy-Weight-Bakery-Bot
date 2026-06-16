const { getDriverByJobId } = require('../db/vehicles');

/**
 * Parses a Job Card message.
 * Expected format:
 * JOB CARD
 * Vehicle : [Reg No]
 * Date : [dd/mm/yyyy] 
 * Job : [Description] 
 * Fuel  : [Digit]
 * Price: [Digit]
 * Time Out: [hh:mm]
 * Time In: [hh:mm]
 * Driver: [Driver ID]
 */
async function handleJobCardMessage(sock, msg, text, senderJid) {
    console.log('[DEBUG] Parsing Job Card...');
    
    // Split text into lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const parsedData = {};
    for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 2) {
            const key = parts[0].trim().toLowerCase();
            const value = parts.slice(1).join(':').trim();
            
            if (key.includes('vehicle')) parsedData.vehicle = value;
            else if (key.includes('date')) parsedData.date = value;
            else if (key.includes('job')) parsedData.job = value;
            else if (key.includes('fuel')) parsedData.fuel = value;
            else if (key.includes('price')) parsedData.price = value;
            else if (key.includes('time out')) parsedData.timeOut = value;
            else if (key.includes('time in')) parsedData.timeIn = value;
            else if (key.includes('driver')) parsedData.driver = value;
        }
    }

    // Validate required fields
    if (!parsedData.vehicle || !parsedData.job || !parsedData.driver) {
        await sock.sendMessage(senderJid, { 
            text: `❌ Could not parse the Job Card properly. Please ensure you use the exact template format.` 
        }, { quoted: msg });
        return;
    }

    // Validate Driver ID
    const driverJobId = parsedData.driver;
    const driver = await getDriverByJobId(driverJobId);

    if (!driver) {
        await sock.sendMessage(senderJid, { 
            text: `❌ Invalid Driver ID: *${driverJobId}*. Please ensure you use the correct 2-digit Job ID.` 
        }, { quoted: msg });
        return;
    }

    // Format the forwarded message
    const formattedMessage = `*JOB CARD*\n` +
        `*Vehicle*: ${parsedData.vehicle.toUpperCase()}\n` +
        `*Date*: ${parsedData.date || 'N/A'}\n` +
        `*Job*: ${parsedData.job}\n` +
        `*Fuel*: ${parsedData.fuel || 'N/A'}\n` +
        `*Price*: ${parsedData.price || 'N/A'}\n` +
        `*Time Out*: ${parsedData.timeOut || 'N/A'}\n` +
        `*Time In*: ${parsedData.timeIn || 'N/A'}\n` +
        `*Driver*: ${driver.name} (ID: ${driverJobId})`;

    const targetGroup = process.env.JOB_CARD_GROUP_JID;
    if (!targetGroup) {
        console.error('JOB_CARD_GROUP_JID is not configured in .env');
        await sock.sendMessage(senderJid, { 
            text: `⚠️ Job Card parsed successfully, but the target WhatsApp group is not configured on the server.` 
        }, { quoted: msg });
        return;
    }

    try {
        await sock.sendMessage(targetGroup, { text: formattedMessage });
        await sock.sendMessage(senderJid, { 
            text: `✅ Job Card successfully verified and sent to the group!` 
        }, { quoted: msg });
    } catch (err) {
        console.error('Failed to forward Job Card to group:', err);
        await sock.sendMessage(senderJid, { 
            text: `❌ Failed to forward Job Card to the group. Please check bot permissions.` 
        }, { quoted: msg });
    }
}

module.exports = {
    handleJobCardMessage
};
