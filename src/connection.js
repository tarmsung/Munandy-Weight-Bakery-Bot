const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default;
const useMultiFileAuthState = baileys.useMultiFileAuthState;
const DisconnectReason = baileys.DisconnectReason;
const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;

const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const { handleMessage } = require('./handlers/messageHandler');
const { setSocket } = require('./state');
const qrcode = require('qrcode-terminal');
const { deleteVehicleExpenseByMessageId } = require('./db/expenses');
const { deleteJobCardByMessageId } = require('./db/jobCards');
const { deleteInspectionReportByMessageId } = require('./db/vehicles');
const { deleteRouteReportByMessageId } = require('./db/routes');

const AUTH_FOLDER = path.join(__dirname, '..', 'auth_info_baileys');

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version, isLatest } = await fetchLatestBaileysVersion();

  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, // Set to false since we handle it manually now
    auth: state,
    browser: ['Munandy Weight Bot', 'Chrome', '1.0.0'],
  });

  // Share the live socket reference
  setSocket(sock);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Scan the QR code below to link your WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

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

      // Handle message deletion (REVOKE)
      if (msg.message.protocolMessage && msg.message.protocolMessage.type === 0) { // 0 is REVOKE
          const deletedMessageId = msg.message.protocolMessage.key.id;
          try {
              const deletedExpense = await deleteVehicleExpenseByMessageId(deletedMessageId);
              if (deletedExpense) {
                  const expenseGroupJid = process.env.EXPENSE_GROUP_JID;
                  if (expenseGroupJid) {
                      await sock.sendMessage(expenseGroupJid, {
                          text: `🗑️ *Expense Deleted*\nThe expense for *${deletedExpense.vehicle_registration}* ($${deletedExpense.amount}) was deleted because the original message was removed.`
                      });
                  }
                  continue;
              }

              const deletedJobCard = await deleteJobCardByMessageId(deletedMessageId);
              if (deletedJobCard) {
                  const jobCardGroupJid = process.env.JOB_CARD_GROUP_JID;
                  if (jobCardGroupJid) {
                      await sock.sendMessage(jobCardGroupJid, {
                          text: `🗑️ *Job Card Deleted*\nThe Job Card for *${deletedJobCard.vehicle_registration}* was deleted because the original message was removed.`
                      });
                  }
                  continue;
              }

              const deletedInspection = await deleteInspectionReportByMessageId(deletedMessageId);
              if (deletedInspection) {
                  const notifyGroupJid = process.env.NOTIFY_GROUP_JID;
                  if (notifyGroupJid) {
                      await sock.sendMessage(notifyGroupJid, {
                          text: `🗑️ *Inspection Report Deleted*\nThe inspection report for *${deletedInspection.vehicle_registration}* was deleted because the report message was removed.`
                      });
                  }
                  continue;
              }

              const deletedRoute = await deleteRouteReportByMessageId(deletedMessageId);
              if (deletedRoute) {
                  const notifyGroupJid = process.env.NOTIFY_GROUP_JID;
                  if (notifyGroupJid) {
                      await sock.sendMessage(notifyGroupJid, {
                          text: `🗑️ *Route Report Deleted*\nA route report was deleted because the report message was removed.`
                      });
                  }
                  continue;
              }
          } catch (err) {
              console.error('Error handling message revocation:', err.message);
          }
          continue;
      }
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
