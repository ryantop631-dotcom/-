import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface RoomState {
  hostSocket?: WebSocket;
  controllerSockets: Set<WebSocket>;
  lastInput?: any;
  lastActive: number;
}

const rooms = new Map<string, RoomState>();

function getOrCreateRoom(roomId: string): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      controllerSockets: new Set<WebSocket>(),
      lastActive: Date.now(),
    };
    rooms.set(roomId, room);
  }
  room.lastActive = Date.now();
  return room;
}

// Cleanup stale rooms older than 1 hour periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms.entries()) {
    if (now - room.lastActive > 3600000 && !room.hostSocket && room.controllerSockets.size === 0) {
      rooms.delete(id);
    }
  }
}, 300000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints
  app.get("/api/config", (req, res) => {
    // When shared or deployed, the public/shared URL allows anyone to access without 403 Google login requirement
    const appUrl = process.env.APP_URL || "";
    // Check if there is an ais-pre (preview/shared) URL variant available
    let publicUrl = appUrl;
    if (appUrl.includes("ais-dev-")) {
      // In Google AI Studio, ais-dev-* requires the project owner's Google account login (403 Forbidden for others)
      // while ais-pre-* or published URLs allow external users without 403
      publicUrl = appUrl.replace("ais-dev-", "ais-pre-");
    }
    res.json({
      appUrl,
      publicUrl,
    });
  });

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      roomsCount: rooms.size,
      uptime: process.uptime(),
    });
  });

  // HTTP fallback for rooms in case of WebSocket proxy latency
  app.post("/api/room/:id/input", (req, res) => {
    const roomId = req.params.id;
    const room = getOrCreateRoom(roomId);
    room.lastInput = req.body;
    room.lastActive = Date.now();
    // Forward to host if connected
    if (room.hostSocket && room.hostSocket.readyState === WebSocket.OPEN) {
      room.hostSocket.send(JSON.stringify({
        type: "input",
        roomId,
        payload: req.body,
      }));
    }
    res.json({ success: true });
  });

  app.get("/api/room/:id/poll", (req, res) => {
    const roomId = req.params.id;
    const room = rooms.get(roomId);
    if (!room) {
      return res.json({ connected: false, input: null });
    }
    res.json({
      connected: room.controllerSockets.size > 0,
      input: room.lastInput || null,
    });
  });

  const server = http.createServer(app);

  // Attach WebSocket Server
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: WebSocket) => {
    let currentRoomId: string | null = null;
    let currentRole: "host" | "controller" | null = null;

    ws.on("message", (data: string) => {
      try {
        const msg = JSON.parse(data.toString());
        const { type, roomId, role, payload } = msg;

        if (!roomId) return;
        const room = getOrCreateRoom(roomId);

        if (type === "register_host") {
          currentRoomId = roomId;
          currentRole = "host";
          room.hostSocket = ws;
          ws.send(JSON.stringify({
            type: "host_ready",
            roomId,
            controllerCount: room.controllerSockets.size,
          }));

          // Notify controller if already present
          for (const ctrl of room.controllerSockets) {
            if (ctrl.readyState === WebSocket.OPEN) {
              ctrl.send(JSON.stringify({ type: "host_ready", roomId }));
            }
          }
        } else if (type === "join_controller") {
          currentRoomId = roomId;
          currentRole = "controller";
          room.controllerSockets.add(ws);

          ws.send(JSON.stringify({
            type: "controller_connected",
            roomId,
            hostConnected: Boolean(room.hostSocket && room.hostSocket.readyState === WebSocket.OPEN),
          }));

          // Notify host
          if (room.hostSocket && room.hostSocket.readyState === WebSocket.OPEN) {
            room.hostSocket.send(JSON.stringify({
              type: "controller_connected",
              roomId,
            }));
          }
        } else if (type === "input") {
          room.lastInput = payload;
          room.lastActive = Date.now();
          if (room.hostSocket && room.hostSocket.readyState === WebSocket.OPEN) {
            room.hostSocket.send(JSON.stringify({
              type: "input",
              roomId,
              payload,
            }));
          }
        } else if (type === "haptic" || type === "game_event") {
          // Forward from host to controller
          for (const ctrl of room.controllerSockets) {
            if (ctrl.readyState === WebSocket.OPEN) {
              ctrl.send(JSON.stringify({
                type,
                roomId,
                payload,
              }));
            }
          }
        } else if (type === "ping") {
          ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        }
      } catch (err) {
        console.error("WS error parsing message:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoomId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          if (currentRole === "host") {
            room.hostSocket = undefined;
            for (const ctrl of room.controllerSockets) {
              if (ctrl.readyState === WebSocket.OPEN) {
                ctrl.send(JSON.stringify({ type: "host_disconnected", roomId: currentRoomId }));
              }
            }
          } else if (currentRole === "controller") {
            room.controllerSockets.delete(ws);
            if (room.hostSocket && room.hostSocket.readyState === WebSocket.OPEN) {
              room.hostSocket.send(JSON.stringify({
                type: "controller_disconnected",
                roomId: currentRoomId,
                controllerCount: room.controllerSockets.size,
              }));
            }
          }
        }
      }
    });
  });

  // Vite middleware in dev, static in prod
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Car Game Server with WebSockets listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
