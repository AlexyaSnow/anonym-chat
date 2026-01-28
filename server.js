const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

// Sert toujours le bon dossier, peu importe d'où tu lances node
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));

// Anti-spam simple: 1 msg / 800ms / client
const lastMsg = new Map();

wss.on("connection", (ws) => {
  const id = Math.random().toString(36).slice(2, 10);
  ws._id = id;

  ws.on("message", (raw) => {
    const now = Date.now();
    const last = lastMsg.get(id) || 0;
    if (now - last < 800) return;
    lastMsg.set(id, now);

    let pkt;
    try {
      pkt = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Room unique forcée
    pkt.room = "Tiktok";

    const out = JSON.stringify(pkt);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(out);
    }
  });

  ws.on("close", () => lastMsg.delete(id));
});

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`✅ Serveur prêt sur le port ${PORT}`);
});