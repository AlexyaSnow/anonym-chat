const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

const connectedUsers = new Map();
const messages = [];
let messageCounter = 0;

function broadcastUserList() {
  const users = Array.from(connectedUsers.values()).map(u => u.username);
  const msg = JSON.stringify({ type: "user_list", users, count: users.length });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

function broadcastMessage(messageId, from, text, timestamp) {
  const msg = JSON.stringify({
    type: "message",
    messageId,
    from,
    text,
    timestamp
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

function broadcastUserEvent(username, action) {
  const msg = JSON.stringify({
    type: "user_event",
    action,
    username,
    timestamp: new Date().toLocaleTimeString()
  });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

wss.on("connection", (ws) => {
  const userId = Math.random().toString(36).slice(2, 10);
  const username = "user-" + userId.slice(0, 6);
  
  connectedUsers.set(userId, { username });
  ws._id = userId;
  ws._username = username;

  broadcastUserList();
  broadcastUserEvent(username, "join");

  ws.on("message", (raw) => {
    let pkt;
    try {
      pkt = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (pkt.type === "chat") {
      const messageId = "msg-" + (messageCounter++);
      const text = pkt.text || "";
      const timestamp = new Date().toLocaleTimeString();
      
      messages.push({ messageId, from: username, text, timestamp });
      broadcastMessage(messageId, username, text, timestamp);
      return;
    }
  });

  ws.on("close", () => {
    connectedUsers.delete(userId);
    broadcastUserList();
    broadcastUserEvent(username, "leave");
  });

  ws.on("error", (err) => {
    console.error("WS Error:", err);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`Serveur pret sur le port ${PORT}`);
});
