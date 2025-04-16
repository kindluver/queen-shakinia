// index.js

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const express = require('express');
const QRCode = require('qrcode'); // Hakikisha umefanya: npm install qrcode

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
    // Onyesha fomu kama hakuna nambari iliyoingizwa
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
  // Tengeneza URL ya pairing (badilisha kama inahitajika)
  const pairingUrl = `https://queen-shakira-d3790e790c70.herokuapp.com/pair?number=${number}&bot=Queen%20Shakira`;
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
let autoStatusSeen = true;
let autoStatusReact = true;

// Storage for antiworld banned words
let antiWorldValues = [];

// Orodha ya groups ambazo functionalities zinapatikana (weka group IDs hapa)
const allowedGroups = [
  '120363365676830775@g.us'
];

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

// Function: Return help/menu text pamoja na image
function getHelpText() {
  return {
    image: { url: "https://files.catbox.moe/2rf7lh.jpg" },
    caption: `> *Queen Shakira Bot All Commands:*

Owner Commands (only for owner):
• auto typing on/off       - Enable/disable auto typing indicator.
• auto recording on/off     - Enable/disable auto recording indicator.
• always online on/off      - Enable/disable always online presence.
• auto status seen on/off   - Enable/disable auto status seen.
• auto status react on/off  - Enable/disable auto reacting to status with 🔥.
• set antiworld word1,word2 - Set banned words (antiworld).
• getgroupid                - Get the current group's ID.
• addgroup group_id         - Add a group (its ID) where full functionality works.

User Commands:
• pair <your_number>        - Generate a QR code/link to pair your WhatsApp with the bot.
• ping                      - Get a ping response.
• .menu or .help            - Show this help message.

Group Management (only if group is in allowedGroups):
• Anti-link   - Links are automatically deleted with a warning.
• Anti-sticker - Stickers are automatically deleted with a warning.
• Antiviewonce - View-once messages are forwarded to the owner.
• Antiworld   - Messages containing banned words are automatically deleted.

> Follow Whatsapp Channel:
www.whatsapp.com/channel/0029VaJX1NzCxoAyVGHlfY2l

> Bot Script Code / Repository:
www.github.com/basanzietech/queen-shakira

> *@basanzietech | queen shakira*`
  };
}

// Hii ni fancy menu kama list message (ikiwa ungependa)
async function sendFancyMenu(sock, jid) {
  const sections = [
    {
      title: "MENU 🌺",
      rows: [
        { title: "YouTube 🌹", rowId: "id-youtube", description: "Visit YouTube channel" },
        { title: "Telegram 💧", rowId: "id-telegram", description: "Open Telegram link" },
        { title: "GitHub 🔵", rowId: "id-github", description: "Open GitHub link" },
        { title: "WhatsApp 🍀", rowId: "id-whatsapp", description: "Join WhatsApp link" },
        { title: "Owner 👤", rowId: "id-owner", description: "Contact Owner" },
        { title: "Script 📄", rowId: "id-script", description: "Get script link" },
      ]
    }
  ];

  const listMessage = {
    title: "Queen Shakira Bot Menu",
    text: "Select an option from the list below:",
    footer: "Powered by Queen Shakira Bot",
    buttonText: "MENU",
    sections
  };

  await sock.sendMessage(jid, listMessage);
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
    const sender = msg.key.participant || msg.key.remoteJid;
    let messageContent = getMessageText(msg).trim();
    const lowerText = messageContent.toLowerCase();

    // Basic commands (ping, getgroupid, .menu/.help, ping) work in any group.
    const basicCommands = ['ping', 'getgroupid', '.menu', '.help'];
    if (jid.endsWith('@g.us') && basicCommands.includes(lowerText)) {
      if (lowerText === 'ping') {
        const start = Date.now();
        await sock.sendMessage(jid, { text: '💫Pong!' });
        const latency = Date.now() - start;
        await sock.sendMessage(jid, { text: `Ping Speed: ${latency} ms` });
        return;
      }
      if (lowerText === 'getgroupid') {
        const groupMeta = await sock.groupMetadata(jid);
        await sock.sendMessage(jid, { text: `Group ID: ${groupMeta.id}` });
        return;
      }
      if (lowerText === '.menu' || lowerText === '.help') {
        // Tumia help text yenye image na caption
        const helpData = getHelpText();
        await sock.sendMessage(jid, { 
          image: { url: helpData.image.url },
          caption: helpData.caption
        });
        return;
      }
    }

    // Kama ni group na sio basic command, angalia allowedGroups.
    if (jid.endsWith('@g.us') && !allowedGroups.includes(jid)) {
      // Ikiwa group haipo kwenye allowedGroups, rudisha bila kufanya tena processing ya functionality nyingine.
      return;
    }

    // ---------- ANTILINK (Group only) ----------
    if (jid.endsWith('@g.us')) {
      const linkRegex = /(https?:\/\/[^\s]+)/gi;
      if (linkRegex.test(lowerText)) {
        const groupMetadata = await sock.groupMetadata(jid);
        const admins = groupMetadata.participants.filter(p => p.admin);
        const isAdmin = admins.some(a => a.id === sender);
        if (!isAdmin) {
          await sock.sendMessage(jid, { delete: msg.key });
          await sock.sendMessage(jid, {
            text: `@${sender.split('@')[0]} Warning: Links are not allowed in this group!`,
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
        text: `@${sender.split('@')[0]} Warning: Stickers are not allowed in this chat!`,
        mentions: [sender]
      });
      return;
    }

    // ---------- ANTIVIEWONCE ----------
    if (msg.message?.viewOnceMessage) {
      const innerMsgObj = msg.message.viewOnceMessage.message;
      if (innerMsgObj.imageMessage || innerMsgObj.videoMessage || innerMsgObj.audioMessage || innerMsgObj.documentMessage) {
        await sock.copyNForward(OWNER, msg, true);
      } else {
        const innerText = getMessageText({ message: innerMsgObj });
        if (innerText) {
          await sock.sendMessage(OWNER, { text: `Antiviewonce triggered. Forwarded viewonce message:\n${innerText}` });
        } else {
          await sock.sendMessage(OWNER, { text: `Antiviewonce triggered. No text found:\n${JSON.stringify(innerMsgObj)}` });
        }
      }
      return;
    }

    // ---------- ANTIWORLD ----------
    if (antiWorldValues.length > 0 && jid !== OWNER) {
      for (let word of antiWorldValues) {
        if (lowerText.includes(word.toLowerCase())) {
          await sock.sendMessage(jid, { delete: msg.key });
          await sock.sendMessage(jid, {
            text: `@${sender.split('@')[0]} Warning: Message contains banned words.`,
            mentions: [sender]
          });
          return;
        }
      }
    }

    // ---------- STATUS HANDLING ----------
    if (jid === 'status@broadcast') {
      if (autoStatusSeen) {
        await sock.readMessages([msg.key]);
      }
      if (autoStatusReact) {
        await sock.sendMessage(jid, { react: { text: '🔥', key: msg.key } });
      }
      if (lowerText.includes('@g.us')) {
        await sock.sendMessage(jid, { delete: msg.key });
        await sock.sendMessage(jid, { text: `Strong Warning: You've never sent a mention-group status!` });
        return;
      }
      return;
    }

    // ---------- OWNER COMMANDS ----------
    if (jid === OWNER) {
      if (lowerText === 'auto typing on') {
        autoTyping = true;
        await sock.sendMessage(jid, { text: 'Auto typing enabled.' });
        return;
      }
      if (lowerText === 'auto typing off') {
        autoTyping = false;
        await sock.sendMessage(jid, { text: 'Auto typing disabled.' });
        return;
      }
      if (lowerText === 'auto recording on') {
        autoRecording = true;
        await sock.sendMessage(jid, { text: 'Auto recording enabled.' });
        return;
      }
      if (lowerText === 'auto recording off') {
        autoRecording = false;
        await sock.sendMessage(jid, { text: 'Auto recording disabled.' });
        return;
      }
      if (lowerText === 'always online on') {
        alwaysOnline = true;
        await sock.sendMessage(jid, { text: 'Always online enabled.' });
        return;
      }
      if (lowerText === 'always online off') {
        alwaysOnline = false;
        await sock.sendMessage(jid, { text: 'Always online disabled.' });
        return;
      }
      if (lowerText === 'auto status seen on') {
        autoStatusSeen = true;
        await sock.sendMessage(jid, { text: 'Auto status seen enabled.' });
        return;
      }
      if (lowerText === 'auto status seen off') {
        autoStatusSeen = false;
        await sock.sendMessage(jid, { text: 'Auto status seen disabled.' });
        return;
      }
      if (lowerText === 'auto status react on') {
        autoStatusReact = true;
        await sock.sendMessage(jid, { text: 'Auto status react enabled.' });
        return;
      }
      if (lowerText === 'auto status react off') {
        autoStatusReact = false;
        await sock.sendMessage(jid, { text: 'Auto status react disabled.' });
        return;
      }
      
      // Process getgroupid if sent from owner inbox or another context.
      if (lowerText === 'getgroupid') {
        if (!jid.endsWith('@g.us')) {
          await sock.sendMessage(jid, { text: 'This is not a group!' });
          return;
        }
        const groupMeta = await sock.groupMetadata(jid);
        await sock.sendMessage(jid, { text: `Group ID: ${groupMeta.id}` });
        return;
      }
      
      if (lowerText.startsWith('set antiworld ')) {
        let values = lowerText.replace('set antiworld ', '').split(',');
        antiWorldValues = values.map(v => v.trim());
        await sock.sendMessage(jid, { text: `Antiworld values set to: ${antiWorldValues.join(', ')}` });
        return;
      }
      
      if (lowerText.startsWith('addgroup ')) {
        const newGroupId = lowerText.replace('addgroup ', '').trim();
        if (!newGroupId.endsWith('@g.us')) {
          await sock.sendMessage(jid, { text: 'Invalid group ID. Must end with @g.us' });
          return;
        }
        if (!allowedGroups.includes(newGroupId)) {
          allowedGroups.push(newGroupId);
          await sock.sendMessage(jid, { text: `Group ${newGroupId} added to allowedGroups.` });
        } else {
          await sock.sendMessage(jid, { text: `Group ${newGroupId} is already in allowedGroups.` });
        }
        return;
      }
    }

    // ---------- USER COMMANDS ----------
    if (lowerText.startsWith('pair ')) {
      const parts = messageContent.split(' ');
      if (parts.length === 2) {
        const number = parts[1];
        const pairingUrl = `https://queen-shakira-d3790e790c70.herokuapp.com/pair?number=${number}&bot=Queen%20Shakira`;
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
  });

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
