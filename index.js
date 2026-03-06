require('dotenv').config();
const { connectToWhatsApp } = require('./src/connection');
const { startScheduler } = require('./src/scheduler');

console.log('🤖 Starting Munandy Weight Bot...');

connectToWhatsApp()
    .then(() => {
        startScheduler();
    })
    .catch((err) => {
        console.error('Fatal error starting bot:', err);
        process.exit(1);
    });
