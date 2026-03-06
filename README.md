# 🤖 Munandy Weight Bot

A WhatsApp bot built with [Baileys](https://github.com/WhiskeySockets/Baileys) — the multi-device WhatsApp Web API library.

---

## 📁 Project Structure

```
Munandy weight-bot/
├── index.js                        # Entry point
├── src/
│   ├── connection.js               # WhatsApp connection & auth
│   └── handlers/
│       └── messageHandler.js       # Command routing & reply logic
├── auth_info_baileys/              # Auto-created on first run (session files)
├── .env                            # Your configuration (never commit this)
├── .gitignore
└── package.json
```

---

## 🚀 Getting Started

### 1. Configure environment variables

Edit the `.env` file:

```env
OWNER_NUMBER=27XXXXXXXXX       # Your WhatsApp number (no +)
TARGET_GROUP_ID=               # Optional target group JID
```

### 2. Start the bot

```bash
npm start
```

On the **first run**, a QR code will print in your terminal. Scan it with WhatsApp:
> **WhatsApp → Settings → Linked Devices → Link a Device**

Once scanned, the session is saved in `auth_info_baileys/` — you won't need to scan again unless you delete it.

### 3. (Optional) Development mode with auto-restart

```bash
npm install -D nodemon
npm run dev
```

---

## 💬 Built-in Commands

| Command | Description |
|---------|-------------|
| `!ping` | Check if bot is alive |
| `!hello` | Greet the bot |
| `!help` | Show all commands |

Add more commands in `src/handlers/messageHandler.js`.

---

## 🔄 Re-authentication

If you need to re-scan the QR code (e.g. after logging out):

```bash
# Delete saved session and restart
Remove-Item -Recurse -Force auth_info_baileys
npm start
```

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `@whiskeysockets/baileys` | WhatsApp Multi-Device API |
| `@hapi/boom` | HTTP-friendly error objects |
| `pino` | Fast JSON logger |
| `qrcode-terminal` | QR code in terminal |
| `dotenv` | Load `.env` variables |
