const WebSocket = require("ws");

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

const rooms = new Map();
let nextPlayerId = 1;

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(room, data) {
    for (const player of room.players.values()) {
        send(player.ws, data);
    }
}

function getRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            players: new Map(),
            started: false
        });
    }
    return rooms.get(roomId);
}

wss.on("connection", (ws) => {
    const player = {
        id: String(nextPlayerId++),
        name: "Player",
        roomId: null,
        x: 120,
        y: 0,
        score: 0,
        lives: 3,
        alive: true,
        ws
    };

    send(ws, {
        type: "connected",
        playerId: player.id
    });

    ws.on("message", (raw) => {
        let msg;

        try {
            msg = JSON.parse(raw.toString());
        } catch {
            send(ws, { type: "error", message: "Data tidak valid" });
            return;
        }

        // BUAT ROOM
        if (msg.type === "create_room") {
            const roomId = String(msg.roomId || "SYAH1").toUpperCase();
            const room = getRoom(roomId);

            if (room.players.size >= 8) {
                send(ws, {
                    type: "error",
                    message: "Room penuh"
                });
                return;
            }

            player.name = String(msg.name || "Player");
            player.roomId = roomId;
            room.players.set(player.id, player);

            send(ws, {
                type: "room_created",
                roomId,
                playerId: player.id
            });

            broadcastRoomState(room);
            return;
        }

        // JOIN ROOM
        if (msg.type === "join_room") {
            const roomId = String(msg.roomId || "").toUpperCase();
            const room = rooms.get(roomId);

            if (!room) {
                send(ws, {
                    type: "error",
                    message: "Room tidak ditemukan"
                });
                return;
            }

            if (room.players.size >= 8) {
                send(ws, {
                    type: "error",
                    message: "Room penuh"
                });
                return;
            }

            player.name = String(msg.name || "Player");
            player.roomId = roomId;
            room.players.set(player.id, player);

            send(ws, {
                type: "joined_room",
                roomId,
                playerId: player.id
            });

            broadcastRoomState(room);
            return;
        }

        // POSISI PEMAIN
        if (msg.type === "move") {
            if (!player.roomId) return;

            const room = rooms.get(player.roomId);
            if (!room) return;

            if (typeof msg.x === "number") player.x = msg.x;
            if (typeof msg.y === "number") player.y = msg.y;

            if (typeof msg.score === "number") {
                player.score = msg.score;
            }

            broadcast(room, {
                type: "player_update",
                player: {
                    id: player.id,
                    name: player.name,
                    x: player.x,
                    y: player.y,
                    score: player.score,
                    lives: player.lives,
                    alive: player.alive
                }
            });

            return;
        }

        // NYAWA
        if (msg.type === "damage") {
            if (!player.roomId) return;

            const room = rooms.get(player.roomId);
            if (!room) return;

            player.lives = Math.max(0, player.lives - 1);

            if (player.lives === 0) {
                player.alive = false;
            }

            broadcast(room, {
                type: "player_damage",
                playerId: player.id,
                lives: player.lives,
                alive: player.alive
            });

            return;
        }

        // SKOR
        if (msg.type === "score") {
            if (!player.roomId) return;

            const room = rooms.get(player.roomId);
            if (!room) return;

            player.score = Number(msg.score) || 0;

            broadcast(room, {
                type: "score_update",
                playerId: player.id,
                score: player.score
            });

            return;
        }

        // MULAI MATCH
        if (msg.type === "start_match") {
            if (!player.roomId) return;

            const room = rooms.get(player.roomId);
            if (!room) return;

            room.started = true;

            broadcast(room, {
                type: "match_started"
            });

            return;
        }
    });

    ws.on("close", () => {
        if (!player.roomId) return;

        const room = rooms.get(player.roomId);

        if (!room) return;

        room.players.delete(player.id);

        broadcastRoomState(room);

        if (room.players.size === 0) {
            rooms.delete(player.roomId);
        }
    });
});

function broadcastRoomState(room) {
    const players = [];

    for (const player of room.players.values()) {
        players.push({
            id: player.id,
            name: player.name,
            x: player.x,
            y: player.y,
            score: player.score,
            lives: player.lives,
            alive: player.alive
        });
    }

    broadcast(room, {
        type: "room_state",
        roomStarted: room.started,
        players
    });
}

console.log("================================");
console.log("     SYAH JUMP ONLINE SERVER");
console.log("================================");
console.log("Server berjalan di port " + PORT);
console.log("Menunggu pemain...");
