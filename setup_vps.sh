#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Munandy Weight Bot — VPS Setup Script (Ubuntu/Debian)
# Run this on your new VPS to install everything required.
# ═══════════════════════════════════════════════════════════════

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting VPS Setup for Munandy Weight Bot..."

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt-update && sudo apt upgrade -y

# 2. Install Node.js (v20 LTS)
echo "🟢 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2 globally
echo "🔄 Installing PM2..."
sudo npm install pm2 -g

# 4. Install bot dependencies
echo "📚 Installing bot dependencies..."
npm install

# 5. Start the bot via PM2
echo "🤖 Starting the bot with PM2..."
npm run pm2:start

# 6. Set PM2 to start on server boot
echo "⚙️ Configuring PM2 to start on boot..."
pm2 startup | tail -n 1 > /tmp/pm2_startup.sh
sudo bash /tmp/pm2_startup.sh
pm2 save

echo ""
echo "✅ Setup Complete!"
echo "Your bot is now running in the background via PM2 and will auto-restart if the server reboots."
echo ""
echo "Next Steps:"
echo "1. Run this command to see the Pairing Code:"
echo "   npm run pm2:logs"
echo "2. Link your bot's WhatsApp number using the code shown in the logs."
