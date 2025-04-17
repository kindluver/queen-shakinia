// index.js

const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const QRCode = require('qrcode');

const app = express();
const port = process.env.PORT || 4000;

// Owner and Channel details
const OWNER = '255657779003@s.whatsapp.net';
const CHANNEL_JID = '0029VaJX1NzCxoAyVGHlfY2l@broadcast';
const CHANNEL_NAME = 'Queen Shakira';

// Groups with full functionality
const allowedGroups = ['120363365676830775@g.us'];

// Feature flags
let autoTyping = false;
let autoRecording = false;
let alwaysOnline = false;
let autoStatusSeen = true;
let autoStatusReact = true;

// Banned words storage
let antiWorldValues = [];

// Default context for forwarded newsletter message
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

// Extract text from any message type
function getMessageText(msg) {
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
  if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
  return '';
}

// Help menu payload
function getHelpText() {
  return {
    image: { url: 'https://files.catbox.moe/2rf7lh.jpg' },
    caption: `> *Queen Shakira Commands:*

Owner Commands (owner only):
• auto typing on/off          - Toggle typing indicator.
• auto recording on/off      - Toggle recording indicator.
• always online on/off       - Toggle always-online status.
• auto status seen on/off    - Toggle auto-status seen.
• auto status react on/off   - Toggle auto-status react.
• set antiworld word1,word2 - Set banned words.
• getgroupid                 - Get the group's ID.
• addgroup <group_id>        - Add group for full features.

User Commands:
• .pair <number>             - Generate pairing QR/link.
• .ping                      - Pong with latency.
• .menu or .help             - Show this help menu.
• .channeljid <channel_link> - Extract channel JID.
• .invite or .getinvite      - Get group invite link.

Group management (allowed groups only):
• Anti-link       - Delete links with warning.
• Anti-sticker    - Delete stickers with warning.
• Antiviewonce    - Forward view-once to owner.
• Antiworld       - Delete messages with banned words.

> Follow our channel:
https://www.whatsapp.com/channel/0029VaJX1NzCxoAyVGHlfY2l

> Repo & Script:
www.github.com/basanzietech/queen-shakira

> *@basanzietech | Queen Shakira*`  
  };
}

// Simulate presence updates
async function simulatePresence(sock, jid) {
  if (autoTyping) {
    await sock.sendPresenceUpdate('composing', jid);
    await new Promise(res => setTimeout(res, 2000));
  }
  if (autoRecording) {
    await sock.sendPresenceUpdate('recording', jid);
    await new Promise(res => setTimeout(res, 2000));
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

  // Web routes
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

    // Handle status messages
    if (jid === 'status@broadcast') {
      if (autoStatusSeen) await sock.readMessages([msg.key]);
      if (autoStatusReact) await sock.sendMessage(jid, { react: { text: '🔥', key: msg.key } });
      return;
    }

    // Commands with prefix '.'
    if (textRaw.startsWith('.')) {
      const args = textRaw.split(' ');
      const command = args[0].slice(1).toLowerCase();
      defaultContext.contextInfo.mentionedJid = [sender];

      // Ping
      if (command === 'ping') {
        const start = Date.now();
        await sock.sendMessage(jid, { text: '💫 Pong!', ...defaultContext });
        const latency = Date.now() - start;
        await sock.sendMessage(jid, { text: `Latency: ${latency} ms`, ...defaultContext });
        return;
      }

      // Menu / Help
      if (['menu','help'].includes(command)) {
        const help = getHelpText();
        await sock.sendMessage(jid, { image: help.image, caption: help.caption, ...defaultContext });
        return;
      }

      // Pairing
      if (command === 'pair') {
        if (args[1]) {
          const url = `https://queen-shakira.herokuapp.com/pair?number=${args[1]}&bot=Queen%20Shakira`;
          try {
            const qrBuf = await QRCode.toBuffer(url);
            await sock.sendMessage(jid, { image: qrBuf, caption: 'Scan to pair.', ...defaultContext });
          } catch {
            await sock.sendMessage(jid, { text: 'Error generating QR.', ...defaultContext });
          }
        } else {
          await sock.sendMessage(jid, { text: 'Use: .pair <number>', ...defaultContext });
        }
        return;
      }

      // Channel JID extraction
      if (command === 'channeljid') {
        if (args[1]) {
          const match = args[1].match(/\/channel\/([A-Za-z0-9_-]+)/);
          if (match) {
            const chanJid = `${match[1]}@broadcast`;
            await sock.sendMessage(jid, { text: `Channel JID: ${chanJid}`, ...defaultContext });
          } else {
            await sock.sendMessage(jid, { text: 'Invalid channel link.', ...defaultContext });
          }
        } else {
          await sock.sendMessage(jid, { text: 'Use: .channeljid <channel_link>', ...defaultContext });
        }
        return;
      }

      // Get group ID
      if (command === 'getgroupid') {
        if (jid.endsWith('@g.us')) {
          const meta = await sock.groupMetadata(jid);
          await sock.sendMessage(jid, { text: `Group ID: ${meta.id}`, ...defaultContext });
        }
        return;
      }

      // Get invite link
      if (['invite','getinvite'].includes(command)) {
        if (!jid.endsWith('@g.us')) {
          await sock.sendMessage(jid, { text: 'Not a group.', ...defaultContext });
        } else {
          try {
            const meta = await sock.groupMetadata(jid);
            const code = meta.inviteCode || meta.groupInviteCode;
            if (code) {
              await sock.sendMessage(jid, { text: `Invite: https://chat.whatsapp.com/${code}`, ...defaultContext });
            } else {
              await sock.sendMessage(jid, { text: 'No invite link.', ...defaultContext });
            }
          } catch {
            await sock.sendMessage(jid, { text: 'Error fetching invite.', ...defaultContext });
          }
        }
        return;
      }

      // Owner-only commands
      if (jid === OWNER) {
        switch (command) {
          case 'auto': {
            if (args[1] === 'typing') {
              autoTyping = args[2] === 'on';
              await sock.sendMessage(jid, { text: `Auto typing ${autoTyping? 'enabled':'disabled'}.`, ...defaultContext });
            } else if (args[1] === 'recording') {
              autoRecording = args[2] === 'on';
              await sock.sendMessage(jid, { text: `Auto recording ${autoRecording? 'enabled':'disabled'}.`, ...defaultContext });
            }
            break;
          }
          case 'always': {
            alwaysOnline = args[2] === 'on';
            await sock.sendMessage(jid, { text: `Always online ${alwaysOnline? 'enabled':'disabled'}.`, ...defaultContext });
            break;
          }
          case 'auto': break; // handled above
          case 'set': {
            if (args[1] === 'antiworld') {
              antiWorldValues = args[2].split(',').map(w => w.trim());
              await sock.sendMessage(jid, { text: `Antiworld: ${antiWorldValues.join(', ')}`, ...defaultContext });
            }
            break;
          }
          case 'addgroup': {
            const gid = args[1];
            if (gid.endsWith('@g.us') && !allowedGroups.includes(gid)) {
              allowedGroups.push(gid);
              await sock.sendMessage(jid, { text: `Added group ${gid}`, ...defaultContext });
            }
            break;
          }
        }
        return;
      }
    }

    // Group filters (allowed groups only)
    if (jid.endsWith('@g.us') && allowedGroups.includes(jid)) {
      // Anti-link
      const linkRegex = /(https?:\/\/[^\s]+)/gi;
      if (linkRegex.test(lowerText)) {
        const meta = await sock.groupMetadata(jid);
        const isAdmin = meta.participants.some(p => p.admin && p.id === sender);
        if (!isAdmin) {
          await sock.sendMessage(jid, { delete: msg.key });
          await sock.sendMessage(jid, { text: 'Links not allowed.', mentions: [sender], ...defaultContext });
          return;
        }
      }
      // Anti-sticker
      if (msg.message.stickerMessage) {
        await sock.sendMessage(jid, { delete: msg.key });
        await sock.sendMessage(jid, { text: 'Stickers not allowed.', mentions: [sender], ...defaultContext });
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
            await sock.sendMessage(jid, { text: 'Banned word detected.', mentions: [sender], ...defaultContext });
            return;
          }
        }
      }
    }

    // Simulate presence for other chats
    simulatePresence(sock, jid);
  });

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close' && (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
      startBot();
    }
  });
}

startBot().catch(console.error);
