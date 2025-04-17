// index.js

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const express = require('express');
const QRCode = require('qrcode'); // npm install qrcode

const app = express();
const port = process.env.PORT || 4000;

// Channel details for "View channel" button
const CHANNEL_JID   = '0@newsletter';
const CHANNEL_NAME  = 'SHAKIRA-MD';

// Default contextInfo (adds "View channel" button)
const defaultContext = {
  contextInfo: {
    isForwarded: true,
    forwardingScore: 999,
    forwardedNewsletterMessageInfo: {
      newsletterJid: CHANNEL_JID,
      newsletterName: CHANNEL_NAME,
      serverMessageId: Date.now()
    }
  }
};

// Owner JID
const OWNER = '255657779003@s.whatsapp.net';

// Global feature flags
let autoTyping = false;
let autoRecording = false;
let alwaysOnline = false;
let autoStatusSeen = true;
let autoStatusReact = true;

// Banned words storage
let antiWorldValues = [];

// Groups with full functionality
const allowedGroups = ['120363365676830775@g.us'];

// Utility: extract text from incoming messages
function getMessageText(msg) {
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
  return '';
}

// Help menu content
function getHelpText() {
  return {
    image: { url: 'https://files.catbox.moe/2rf7lh.jpg' },
    caption: `> *Queen Shakira Commands:*

Owner Commands (owner only):
• auto typing on/off       - Enable/disable auto typing indicator.
• auto recording on/off     - Enable/disable auto recording indicator.
• always online on/off      - Enable/disable always online presence.
• auto status seen on/off   - Enable/disable auto status seen.
• auto status react on/off  - Enable/disable auto reacting to status with 🔥.
• set antiworld word1,word2 - Set banned words (antiworld).
• getgroupid                - Get the current group's ID.
• addgroup group_id         - Add a group (its ID) where full functionality works.

User Commands:
• .pair <your_number>       - Generate a QR code/link to pair WhatsApp.
• .ping                     - Get a ping response.
• .menu or .help            - Show this help message.

Group management (allowedGroups only):
• Anti-link       - Deletes links with a warning.
• Anti-sticker    - Deletes stickers with a warning.
• Antiviewonce    - Forwards view-once messages to owner.
• Antiworld       - Deletes messages containing banned words.

> Follow Whatsapp Channel:
www.whatsapp.com/channel/0029VaJX1NzCxoAyVGHlfY2l

> Script & Repo:
www.github.com/basanzietech/queen-shakira

> *@basanzietech | Queen Shakira*`
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

  // Express routes
  app.get('/', (req, res) => res.send('Queen Shakira is active 👸'));
  app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.send(`<form>Enter number:</form>`);
    const url = `https://queen-shakira.herokuapp.com/pair?number=${number}&bot=Queen%20Shakira`;
    const qr = await QRCode.toDataURL(url);
    res.send(`<img src="${qr}" /><p>${url}</p>`);
  });
  app.listen(port, () => console.log(`Listening on port ${port}`));

  sock.ev.on('messages.upsert', async m => {
    const msg = m.messages?.[0];
    if (!msg?.message) return;

    const jid = msg.key.remoteJid;
    const sender = msg.key.participant || jid;
    const textRaw = getMessageText(msg).trim();
    const lowerText = textRaw.toLowerCase();

    // ---------- GROUP FILTERS (no prefix required) ----------
    if (jid.endsWith('@g.us')) {
      // Anti-link
      const linkRegex = /(https?:\/\/[^\s]+)/gi;
      if (linkRegex.test(lowerText)) {
        const meta = await sock.groupMetadata(jid);
        const isAdmin = meta.participants.some(p => p.admin && p.id === sender);
        if (!isAdmin) {
          await sock.sendMessage(jid, { delete: msg.key });
          await sock.sendMessage(jid, {
            text: `Warning: Links are not allowed!`,
            mentions: [sender],
            ...defaultContext
          });
          return;
        }
      }
      // Anti-sticker
      if (msg.message.stickerMessage) {
        await sock.sendMessage(jid, { delete: msg.key });
        await sock.sendMessage(jid, { text: `Stickers not allowed!`, mentions: [sender], ...defaultContext });
        return;
      }
      // Antiviewonce
      if (msg.message.viewOnceMessage) {
        await sock.copyNForward(OWNER, msg, true);
        return;
      }
      // Antiworld
      if (antiWorldValues.length) {
        for (let w of antiWorldValues) {
          if (lowerText.includes(w.toLowerCase())) {
            await sock.sendMessage(jid, { delete: msg.key });
            await sock.sendMessage(jid, { text: `Banned word detected!`, mentions: [sender], ...defaultContext });
            return;
          }
        }
      }
    }

    // ---------- STATUS HANDLING ----------
    if (jid === 'status@broadcast') {
      if (autoStatusSeen) await sock.readMessages([msg.key]);
      if (autoStatusReact) await sock.sendMessage(jid, { react: { text: '🔥', key: msg.key } });
      return;
    }

    // Only commands with prefix '.'
    if (!textRaw.startsWith('.')) return;
    const command = textRaw.slice(1).toLowerCase();
    defaultContext.contextInfo.mentionedJid = [sender];

    // ---------- BASIC COMMANDS ----------
    if (['ping','getgroupid','menu','help'].includes(command)) {
      if (jid.endsWith('@g.us')) {
        if (command === 'ping') {
          const start = Date.now();
          await sock.sendMessage(jid, { text: '💫 Pong!', ...defaultContext });
          const latency = Date.now() - start;
          await sock.sendMessage(jid, { text: `Speed: ${latency} ms`, ...defaultContext });
        }
        if (command === 'getgroupid') {
          const meta = await sock.groupMetadata(jid);
          await sock.sendMessage(jid, { text: `Group ID: ${meta.id}`, ...defaultContext });
        }
        if (['menu','help'].includes(command)) {
          const help = getHelpText();
          await sock.sendMessage(jid, { image: help.image, caption: help.caption, ...defaultContext });
        }
      }
      return;
    }

    // Restrict full features to allowed groups
    if (jid.endsWith('@g.us') && !allowedGroups.includes(jid)) return;

    // ---------- OWNER COMMANDS ----------
    if (jid === OWNER) {
      switch (command) {
        case 'auto typing on': autoTyping=true; await sock.sendMessage(jid,{text:'Auto typing on',...defaultContext}); break;
        case 'auto typing off': autoTyping=false; await sock.sendMessage(jid,{text:'Auto typing off',...defaultContext}); break;
        case 'auto recording on': autoRecording=true; await sock.sendMessage(jid,{text:'Auto recording on',...defaultContext}); break;
        case 'auto recording off': autoRecording=false; await sock.sendMessage(jid,{text:'Auto recording off',...defaultContext}); break;
        case 'always online on': alwaysOnline=true; await sock.sendMessage(jid,{text:'Always online on',...defaultContext}); break;
        case 'always online off': alwaysOnline=false; await sock.sendMessage(jid,{text:'Always online off',...defaultContext}); break;
        case 'auto status seen on': autoStatusSeen=true; await sock.sendMessage(jid,{text:'Auto status seen on',...defaultContext}); break;
        case 'auto status seen off': autoStatusSeen=false; await sock.sendMessage(jid,{text:'Auto status seen off',...defaultContext}); break;
        case 'auto status react on': autoStatusReact=true; await sock.sendMessage(jid,{text:'Auto status react on',...defaultContext}); break;
        case 'auto status react off': autoStatusReact=false; await sock.sendMessage(jid,{text:'Auto status react off',...defaultContext}); break;
        default:
          if (command.startsWith('set antiworld ')) {
            antiWorldValues = command.replace('set antiworld ','').split(',').map(w=>w.trim());
            await sock.sendMessage(jid,{text:`Antiworld set: ${antiWorldValues.join(', ')}`,...defaultContext});
          } else if (command.startsWith('addgroup ')) {
            const id = command.replace('addgroup ','').trim();
            if (id.endsWith('@g.us') && !allowedGroups.includes(id)) { allowedGroups.push(id); await sock.sendMessage(jid,{text:`Added group ${id}`,...defaultContext}); }
            else await sock.sendMessage(jid,{text:'Invalid or existing group ID.',...defaultContext});
          }
      }
      return;
    }

    // ---------- USER COMMANDS ----------
    if (command.startsWith('pair ')) {
      const parts = textRaw.split(' ');
      if (parts[1]) {
        const url = `https://queen-shakira.herokuapp.com/pair?number=${parts[1]}&bot=Queen%20Shakira`;
        try {
          const qr = await QRCode.toBuffer(url);
          await sock.sendMessage(jid,{image:qr,caption:'Scan to link.',...defaultContext});
        } catch {
          await sock.sendMessage(jid,{text:'Error generating QR.',...defaultContext});}
      } else {
        await sock.sendMessage(jid,{text:'Use: .pair <number>',...defaultContext});
      }
      return;
    }

    // Simulate presence (typing/recording/available)
    simulatePresence(sock, jid);
  });

  sock.ev.on('connection.update', ({connection,lastDisconnect})=>{
    if (connection==='close') {
      if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) startBot();
    }
  });
}

startBot().catch(console.error);
