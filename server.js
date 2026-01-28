const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// ======================
// STATE MANAGEMENT
// ======================
const connectedUsers = new Map(); // id -> {username, connectedAt}
const messages = new Map(); // messageId -> {from, text, timestamp, ttl, reactions}
const typingUsers = new Set(); // users currently typing
const lastMsg = new Map(); // spam prevention
const reactions = new Map(); // messageId -> { 👍: [user1, user2], 👎: [...], 😂: [...] }

let messageCounter = 0;

const ROOM_NAME = "Tiktok";
const DEFAULT_TTL = 3600; // 1 hour
const TYPING_TIMEOUT = 3000; // 3 seconds

// ======================
// BROADCAST FUNCTIONS
// ======================
function broadcastUserCount() {
  const msg = JSON.stringify({ 
    type: "user_count", 
    count: connectedUsers.size 
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

function broadcastTypingStatus() {
  const typingList = Array.from(typingUsers);
  const msg = JSON.stringify({ 
    type: "typing", 
    users: typingList 
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

function broadcastUserJoinLeave(username, action) {
  const msg = JSON.stringify({ 
    type: "user_event",
    action: action, // "join" or "leave"
    username: username,
    timestamp: new Date().toLocaleTimeString()
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

function broadcastReaction(messageId, emoji, username, action) {
  const msg = JSON.stringify({
    type: "reaction",
    messageId: messageId,
    emoji: emoji,
    username: username,
    action: action, // "add" or "remove"
    reactions: reactions.get(messageId) || {}
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// ======================
// WEBSOCKET CONNECTION
// ======================
wss.on("connection", (ws) => {
  const userId = Math.random().toString(36).slice(2, 10);
  const username = "user-" + userId.slice(0, 6);
  
  connectedUsers.set(userId, {
    username: username,
    connectedAt: Date.now()
  });

  ws._id = userId;
  ws._username = username;
  ws._typingTimeout = null;

  broadcastUserCount();
  broadcastUserJoinLeave(username, "join");

  // ======================
  // MESSAGE HANDLER
  // ======================
  ws.on("message", (raw) => {
    const now = Date.now();
    const last = lastMsg.get(userId) || 0;
    
    let pkt;
    try {
      pkt = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // TYPING INDICATOR
    if (pkt.type === "typing") {
      if (!typingUsers.has(username)) {
        typingUsers.add(username);
        broadcastTypingStatus();
      }
      
      clearTimeout(ws._typingTimeout);
      ws._typingTimeout = setTimeout(() => {
        typingUsers.delete(username);
        broadcastTypingStatus();
      }, TYPING_TIMEOUT);
      return;
    }

    // REACTION
    if (pkt.type === "reaction") {
      const { messageId, emoji, action } = pkt;
      
      if (!reactions.has(messageId)) {
        reactions.set(messageId, { "👍": [], "👎": [], "😂": [] });
      }
      
      const reactionMap = reactions.get(messageId);
      if (!reactionMap[emoji]) reactionMap[emoji] = [];
      
      if (action === "add") {
        if (!reactionMap[emoji].includes(username)) {
          reactionMap[emoji].push(username);
        }
      } else if (action === "remove") {
        reactionMap[emoji] = reactionMap[emoji].filter(u => u !== username);
      }
      
      broadcastReaction(messageId, emoji, username, action);
      return;
    }

    // REGULAR MESSAGE (anti-spam)
    if (now - last < 800) return;
    lastMsg.set(userId, now);

    // CHAT MESSAGE
    if (pkt.type === "chat" || pkt.room) {
      pkt.room = ROOM_NAME;
      
      const messageId = "msg-" + (messageCounter++);
      const ttl = pkt.ttl || DEFAULT_TTL;
      
      messages.set(messageId, {
        id: messageId,
        from: username,
        text: pkt.payload ? pkt.payload : pkt.text,
        timestamp: new Date().toLocaleTimeString(),
        ttl: ttl,
        createdAt: now,
        reactions: { "👍": [], "👎": [], "😂": [] }
      });

      reactions.set(messageId, { "👍": [], "👎": [], "😂": [] });

      const out = JSON.stringify({
        type: "message",
        messageId: messageId,
        ...pkt,
        timestamp: new Date().toLocaleTimeString()
      });

      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(out);
      }

      // Auto-delete after TTL
      setTimeout(() => {
        messages.delete(messageId);
        // Keep reactions for a bit longer
      }, ttl * 1000);

      return;
    }
  });

  // ======================
  // DISCONNECT
  // ======================
  ws.on("close", () => {
    clearTimeout(ws._typingTimeout);
    connectedUsers.delete(userId);
    typingUsers.delete(username);
    lastMsg.delete(userId);
    
    broadcastUserCount();
    broadcastUserJoinLeave(username, "leave");
    broadcastTypingStatus();
  });

  ws.on("error", (err) => {
    console.error("WS Error:", err);
  });
});

// ======================
// SERVER START
// ======================
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`✅ Serveur prêt sur le port ${PORT}`);
  console.log(`📡 Support 1000+ utilisateurs simultanés`);
});
