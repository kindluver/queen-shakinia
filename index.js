// index.js

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const express = require('express');
const QRCode = require('qrcode'); // Install with: npm install qrcode

const app = express();
const port = process.env.PORT || 4000;

// Basic landing page
app.get('/', (req, res) => {
  res.send('Hello World!👀 Queen Shakira is active now👸');
});

// Web route for pairing
app.get('/pair', async (req, res) => {
  const number = req.query.number;
  if (!number) {
    // Show a form if no number is provided
    return res.send(`
      <html>
        <head>
          <title>Pair Your WhatsApp</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            label, input { font-size: 16px; }
          </style>
        </head>
        <body>
          <h1>Pair Your WhatsApp with Queen Shakira</h1>
          <form method="GET" action="/pair">
            <label for="number">Enter your number:</label>
            <input type="text" id="number" name="number" required />
            <button type="submit">Pair</button>
          </form>
        </body>
      </html>
    `);
  }
  // Construct the pairing URL (adjust the URL as needed for your pairing service)
  const pairingUrl = `https://example.com/pair?number=${number}&bot=Queen%20Shakira`;
  try {
    const qrDataUrl = await QRCode.toDataURL(pairingUrl);
    res.send(`
      <html>
        <head>
          <title>Pair Your WhatsApp</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            p { font-size: 16px; }
            a { color: blue; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>Pair Your WhatsApp with Queen Shakira</h1>
          <p>Scan the QR code below to link your WhatsApp:</p>
          <img src="${qrDataUrl}" alt="QR Code" style="width:300px;height:300px;" />
          <p>Or click this pairing link: <a href="${pairingUrl}">${pairingUrl}</a></p>
        </body>
      </html>
    `);
  } catch (err) {
    res.send(`Error generating QR code: ${err}`);
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// Define owner JID
const OWNER = '255657779003@s.whatsapp.net';

// Global flags for auto presence and status features
let autoTyping = false;
let autoRecording = false;
let alwaysOnline = false;
let autoStatusSeen = false;
let autoStatusReact = false;

// Storage for antiworld banned words
let antiWorldValues = [];

// Utility: Get text from a message regardless of its type
function getMessageText(msg) {
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text)
    return msg.message.extendedTextMessage.text;
  if (msg.message.imageMessage && msg.message.imageMessage.caption)
    return msg.message.imageMessage.caption;
  if (msg.message.videoMessage && msg.message.videoMessage.caption)
    return msg.message.videoMessage.caption;
  return '';
}

// Function: Return help/menu text
function getHelpText() {
  return `Queen Shakira Bot Help:

Owner Commands (only for owner):
• auto typing on/off       - Enable/disable auto typing indicator.
• auto recording on/off     - Enable/disable auto recording indicator.
• always online on/off      - Enable/disable always online presence.
• auto status seen on/off   - Enable/disable auto status seen.
• auto status react on/off  - Enable/disable auto reacting to status with 🔥.
• set antiworld word1,word2 - Set banned words (antiworld).

User Commands:
• pair <your_number>        - Generate a QR code/link to pair your WhatsApp with the bot.
• .menu or .help            - Show this help message.

Group Management:
• Anti-link   - Links in groups are automatically deleted with a warning.
• Anti-sticker - Stickers are automatically deleted with a warning.
• Antiviewonce - View-once messages are forwarded to the owner.
• Antiworld   - Messages containing banned words are automatically deleted.

Enjoy using Queen Shakira Bot!`;
}

// Function: Simulate presence update (auto typing, recording, always online)
async function simulatePresence(sock, jid) {
  if (autoTyping) {
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (autoRecording) {
    await sock.sendPresenceUpdate('recording', jid);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (alwaysOnline) {
    await sock.sendPresenceUpdate('available', jid);
  }
}

// Start the bot and initialize connection
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  // Listen for incoming messages
  sock.ev.on('messages.upsert', async (m) => {
    const messages = m.messages;
    if (!messages || messages.length === 0) return;
    const msg = messages[0];
    if (!msg.message) return;
    const jid = msg.key.remoteJid;
    // For groups, sender is in key.participant; otherwise use remoteJid.
    const sender = msg.key.participant || msg.key.remoteJid;
    
    // ---------- ANTILINK (Group only) ----------
    if (jid.endsWith('@g.us')) {
      const text = getMessageText(msg);
      const linkRegex = /(https?:\/\/[^\s]+)/gi;
      if (linkRegex.test(text)) {
        // Check if sender is admin; hapa unaweza kubainisha admin. Ikiwa si admin, futa.
        const groupMetadata = await sock.groupMetadata(jid);
        // Wanaopata 'admin' ni wale ambao wana role ya admin, au "superadmin"
        const admins = groupMetadata.participants.filter(p => p.admin);
        const isAdmin = admins.some(a => a.id === sender);
        if (!isAdmin) {
          await sock.sendMessage(jid, { delete: msg.key });
          await sock.sendMessage(jid, { 
            text: `@${sender.split('@')[0]} Warning: 📌Links are not allowed in this group!`,
            mentions: [sender]
          });
          return;
        }
      }
    }
    
    // ---------- ANTISTICKER ----------
    if (msg.message.stickerMessage) {
      await sock.sendMessage(jid, { delete: msg.key });
      await sock.sendMessage(jid, { 
        text: `@${sender.split('@')[0]} Warning: Stickers is not allowed in this group!`,
        mentions: [sender]
      });
      return;
    }

    // ---------- ANTIVIEWONCE ----------
  /*  if (msg.message?.viewOnceMessage) {
      await sock.sendMessage(OWNER, { text: `Antiviewonce triggered. Forwarded view-once message:\n${JSON.stringify(msg.message)}` });
      return;
    }*/
// ---------- ANTIVIEWONCE ----------
if (msg.message?.viewOnceMessage) {
  // Extract inner message object
  const innerMsgObj = msg.message.viewOnceMessage.message;

  // Kagua kama inner message ina media (image, video, audio, document)
  if (innerMsgObj.imageMessage || innerMsgObj.videoMessage || innerMsgObj.audioMessage || innerMsgObj.documentMessage) {
    // Tumia copyNForward ili kumpeleka ujumbe kamili wa media kwa OWNER
    await sock.copyNForward(OWNER, msg, true);
  } else {
    // Kama ni maandishi, jaribu kupata maandishi na umpe owner
    const innerText = getMessageText({ message: innerMsgObj });
    if (innerText) {
      await sock.sendMessage(OWNER, { text: `Antiviewonce triggered. Forwarded viewonce message:\n${innerText}` });
    } else {
      // Fallback: tuma JSON ya inner message kama maandishi hayapatikani
      await sock.sendMessage(OWNER, { text: `Antiviewonce triggered. Forwarded viewonce message:\n${JSON.stringify(innerMsgObj)}` });
    }
  }
  return;
}


    // Get message content in lower case
    let messageContent = getMessageText(msg).trim().toLowerCase();

    // ---------- ANTIWORLD ----------
    if (antiWorldValues.length > 0 && jid !== OWNER) {
      for (let word of antiWorldValues) {
        if (messageContent.includes(word.toLowerCase())) {
          await sock.sendMessage(jid, { delete: msg.key });
          await sock.sendMessage(jid, { 
            text: `@${sender.split('@')[0]} Warning: Message Bad Words or Group Mentioned are not allowed here📌.`,
            mentions: [sender]
          });
          return;
        }
      }
    }

    // ---------- STATUS HANDLING ----------
    if (jid === 'status@broadcast') {
      console.log("New status detected");
      if (autoStatusSeen) {
        await sock.readMessages([msg.key]);
      }
      if (autoStatusReact) {
        await sock.sendMessage(jid, { react: { text: '🔥', key: msg.key } });
      }
      if (messageContent.includes('@g.us')) {
        await sock.sendMessage(jid, { delete: msg.key });
        await sock.sendMessage(jid, { text: `Strong Warning: You've never sent a MENTION GROUP STATUS!` });
        return;
      }
      return;
    }

    // ---------- OWNER COMMANDS ----------
    if (jid === OWNER) {
      if (messageContent === 'auto typing on') {
        autoTyping = true;
        await sock.sendMessage(jid, { text: 'Auto typing enabled.' });
        return;
      }
      if (messageContent === 'auto typing off') {
        autoTyping = false;
        await sock.sendMessage(jid, { text: 'Auto typing disabled.' });
        return;
      }
      if (messageContent === 'auto recording on') {
        autoRecording = true;
        await sock.sendMessage(jid, { text: 'Auto recording enabled.' });
        return;
      }
      if (messageContent === 'auto recording off') {
        autoRecording = false;
        await sock.sendMessage(jid, { text: 'Auto recording disabled.' });
        return;
      }
      if (messageContent === 'always online on') {
        alwaysOnline = true;
        await sock.sendMessage(jid, { text: 'Always online enabled.' });
        return;
      }
      if (messageContent === 'always online off') {
        alwaysOnline = false;
        await sock.sendMessage(jid, { text: 'Always online disabled.' });
        return;
      }
      if (messageContent === 'auto status seen on') {
        autoStatusSeen = true;
        await sock.sendMessage(jid, { text: 'Auto status seen enabled.' });
        return;
      }
      if (messageContent === 'auto status seen off') {
        autoStatusSeen = false;
        await sock.sendMessage(jid, { text: 'Auto status seen disabled.' });
        return;
      }
      if (messageContent === 'auto status react on') {
        autoStatusReact = true;
        await sock.sendMessage(jid, { text: 'Auto status react enabled.' });
        return;
      }
      if (messageContent === 'auto status react off') {
        autoStatusReact = false;
        await sock.sendMessage(jid, { text: 'Auto status react disabled.' });
        return;
      }
      if (messageContent.startsWith('set antiworld ')) {
        // Expected format: "set antiworld word1,word2,word3"
        let values = messageContent.replace('set antiworld ', '').split(',');
        antiWorldValues = values.map(v => v.trim());
        await sock.sendMessage(jid, { text: `Antiworld values set to: ${antiWorldValues.join(', ')}` });
        return;
      }
    }

    // ---------- USER COMMANDS ----------
    // Help/Menu command
    if (messageContent === '.menu' || messageContent === '.help') {
      await sock.sendMessage(jid, { text: getHelpText() });
      return;
    }
    
    // ---------- MULTIPLE SESSION PAIRING ----------
    if (messageContent.startsWith('pair ')) {
      // Expected format: "pair <your_number>"
      const parts = messageContent.split(' ');
      if (parts.length === 2) {
        const number = parts[1];
        // Generate a pairing URL (adjust as needed)
        const pairingUrl = `https://example.com/pair?number=${number}&bot=Queen%20Shakira`;
        try {
          const qrBuffer = await QRCode.toBuffer(pairingUrl);
          await sock.sendMessage(jid, { image: qrBuffer, caption: `Scan this QR code to link your WhatsApp with Queen Shakira.` });
        } catch (err) {
          await sock.sendMessage(jid, { text: `Error generating QR code. Please try again later.` });
        }
      } else {
        await sock.sendMessage(jid, { text: `Invalid format. Use: pair <your_number>` });
      }
      return;
    }

    // ---------- SIMULATE PRESENCE ----------
    simulatePresence(sock, jid);
    
    // Other messages are not processed further
  });

  // Handle connection updates with logging
  sock.ev.on('connection.update', (update) => {
    console.log('Connection update:', update);
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      console.log('Connection closed. Details:', lastDisconnect);
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        startBot();
      }
    } else if (connection === 'open') {
      console.log('Connection opened');
    }
  });
}

startBot().catch(err => console.log("Unexpected error:", err));
