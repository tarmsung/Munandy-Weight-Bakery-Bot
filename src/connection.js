const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const DisconnectReason = baileys.DisconnectReason;
const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
const makeInMemoryStore = baileys.makeInMemoryStore;

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const { handleMessage } = require('./handlers/messageHandler');
const { setSocket } = require('./state');

const AUTH_FOLDER = path.join(__dirname, '..', 'auth_info_baileys');

const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: !state.creds.registered, // Only print QR if pairing code fails or as fallback
    auth: state,
    browser: ['Munandy Weight Bot', 'Chrome', '1.0.0'],
  });

  // Request pairing code if not registered
  if (!sock.authState.creds.registered) {
    const phoneNumber = '263786283617';
    console.log(`\nRequesting pairing code for bot number: ${phoneNumber}...`);
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        console.log(`\n=========================================`);
        console.log(`🔑 PAIRING CODE: ${code}`);
        console.log(`=========================================\n`);
        console.log(`1. Open WhatsApp on your phone`);
        console.log(`2. Tap Menu (⋮) or Settings > Linked Devices`);
        console.log(`3. Tap "Link a device"`);
        console.log(`4. Tap "Link with phone number instead" (at bottom)`);
        console.log(`5. Enter the pairing code above`);
      } catch (err) {
        console.error('Failed to request pairing code:', err.message);
      }
    }, 3000);
  }

  // Share the live socket reference
  setSocket(sock);

  store.bind(sock.ev);
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      console.log(`Connection closed (code: ${code}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        await connectToWhatsApp();
      } else {
        console.log('Logged out. Delete auth_info_baileys/ and restart to re-scan QR.');
      }
    } else if (connection === 'open') {
      console.log('✅ Bot connected to WhatsApp!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error('Error handling message:', err.message);
      }
    }
  });

  return sock;
}

module.exports = { connectToWhatsApp };
