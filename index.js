// index.js

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const express = require('express');
const QRCode = require('qrcode'); // npm install qrcode

const app = express();
const port = process.env.PORT || 4000;

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

// Allowed groups for full functionality
const allowedGroups = ['120363365676830775@g.us'];

// Default contextInfo for newsletter format
const defaultContext = {
  contextInfo: {
    mentionedJid: [], // will be set per message
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
      newsletterJid: '0@newsletter',
      newsletterName: 'SHAKIRA-MD',
      serverMessageId: -1
    }
  }
};

// Utility: Get text from a message
function getMessageText(msg) {
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
  return '';
}

// Function: Return help/menu text with image
function getHelpText() {
  return {
    image: { url: 'https://files.catbox.moe/2rf7lh.jpg' },
    caption: `> *Queen Shakira Commands:*

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
• .pair <your_number>        - Generate a QR code/link to pair your WhatsApp with the bot.
• .ping                      - Get a ping response.
• .menu or .help             - Show this help message.

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

// Simulate presence updates
async function simulatePresence(sock, jid) {
  if (autoTyping) {
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(r => setTimeout(r, 2000));
  }
  if (autoRecording) {
    await sock.sendPresenceUpdate('recording', jid);
    await new Promise(r => setTimeout(r, 2000));
  }
  if (alwaysOnline) {
    await sock.sendPresenceUpdate('available', jid);
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth: state, printQRInTerminal: true });
  sock.ev.on('creds.update', saveCreds);

  // Express server
  app.get('/', (req, res) => res.send('Hello World!👀 Queen Shakira is active now👸'));
  app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.send(/* form HTML... */);
    const pairingUrl = `https://queen-shakira.herokuapp.com/pair?number=${number}&bot=Queen%20Shakira`;
    try {
      const qrDataUrl = await QRCode.toDataURL(pairingUrl);
      res.send(/* QR HTML with ${qrDataUrl} and ${pairingUrl} */);
    } catch (err) {
      res.send(`Error generating QR code: ${err}`);
    }
  });
  app.listen(port, () => console.log(`App listening on port ${port}`));

  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages?.[0];
    if (!msg?.message) return;

    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    let text = getMessageText(msg).trim();
    if (!text.startsWith('.')) return;                // only respond to commands with '.' prefix
    const command = text.slice(1).toLowerCase();

    // prepare context for replies
    defaultContext.contextInfo.mentionedJid = [sender];

    // Basic commands
    if (['ping', 'getgroupid', 'menu', 'help'].includes(command)) {
      if (jid.endsWith('@g.us')) {
        if (command === 'ping') {
          const start = Date.now();
          await sock.sendMessage(jid, { text: '💫Pong!', ...defaultContext });
          const latency = Date.now() - start;
          await sock.sendMessage(jid, { text: `Ping Speed: ${latency} ms`, ...defaultContext });
        }
        if (command === 'getgroupid') {
          const meta = await sock.groupMetadata(jid);
          await sock.sendMessage(jid, { text: `Group ID: ${meta.id}`, ...defaultContext });
        }
        if (command === 'menu' || command === 'help') {
          const help = getHelpText();
          await sock.sendMessage(jid, { image: help.image, caption: help.caption, ...defaultContext });
        }
      }
      return;
    }

    // group restrictions
    if (jid.endsWith('@g.us') && !allowedGroups.includes(jid)) return;

    // owner-only commands (sent in direct chat)
    if (jid === OWNER) {
      switch (command) {
        case 'auto typing on': autoTyping = true; await sock.sendMessage(jid, { text: 'Auto typing enabled.', ...defaultContext }); break;
        case 'auto typing off': autoTyping = false; await sock.sendMessage(jid, { text: 'Auto typing disabled.', ...defaultContext }); break;
        case 'auto recording on': autoRecording = true; await sock.sendMessage(jid, { text: 'Auto recording enabled.', ...defaultContext }); break;
        case 'auto recording off': autoRecording = false; await sock.sendMessage(jid, { text: 'Auto recording disabled.', ...defaultContext }); break;
        case 'always online on': alwaysOnline = true; await sock.sendMessage(jid, { text: 'Always online enabled.', ...defaultContext }); break;
        case 'always online off': alwaysOnline = false; await sock.sendMessage(jid, { text: 'Always online disabled.', ...defaultContext }); break;
        case 'auto status seen on': autoStatusSeen = true; await sock.sendMessage(jid, { text: 'Auto status seen enabled.', ...defaultContext }); break;
        case 'auto status seen off': autoStatusSeen = false; await sock.sendMessage(jid, { text: 'Auto status seen disabled.', ...defaultContext }); break;
        case 'auto status react on': autoStatusReact = true; await sock.sendMessage(jid, { text: 'Auto status react enabled.', ...defaultContext }); break;
        case 'auto status react off': autoStatusReact = false; await sock.sendMessage(jid, { text: 'Auto status react disabled.', ...defaultContext }); break;
        default:
          if (command.startsWith('set antiworld ')) {
            antiWorldValues = command.replace('set antiworld ', '').split(',').map(w => w.trim());
            await sock.sendMessage(jid, { text: `Antiworld values set to: ${antiWorldValues.join(', ')}`, ...defaultContext });
          } else if (command.startsWith('addgroup ')) {
            const newId = command.replace('addgroup ', '').trim();
            if (!newId.endsWith('@g.us')) return await sock.sendMessage(jid, { text: 'Invalid group ID.', ...defaultContext });
            if (!allowedGroups.includes(newId)) { allowedGroups.push(newId); await sock.sendMessage(jid, { text: `Group ${newId} added.`, ...defaultContext }); }
            else await sock.sendMessage(jid, { text: `Group ${newId} already exists.`, ...defaultContext });
          }
      }
      return;
    }

    // pairing command
    if (command.startsWith('pair ')) {
      const parts = text.split(' ');
      if (parts.length === 2) {
        const number = parts[1];
        const url = `https://queen-shakira.herokuapp.com/pair?number=${number}&bot=Queen%20Shakira`;
        try {
          const qr = await QRCode.toBuffer(url);
          await sock.sendMessage(jid, { image: qr, caption: `Scan to link your WhatsApp with Queen Shakira.`, ...defaultContext });
        } catch {
          await sock.sendMessage(jid, { text: `Error generating QR code.`, ...defaultContext });
        }
      } else {
        await sock.sendMessage(jid, { text: `Invalid format. Use .pair <number>`, ...defaultContext });
      }
      return;
    }

    // simulate presence for non-commands
    simulatePresence(sock, jid);
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    }
  });
}

startBot().catch(console.error);
