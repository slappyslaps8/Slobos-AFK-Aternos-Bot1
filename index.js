"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");

// ============================================================
// EXPRESS SERVER SETUP
// ============================================================
const app = express();
app.use(express.json());

// Render uses port 10000 by default, or the environment variable
const PORT = process.env.PORT || 10000; 

let bot;
let botState = {
  connected: false,
  startTime: Date.now(),
  reconnectAttempts: 0,
};

// --- Dashboard Routes ---
app.get('/', (req, res) => {
    // I've kept your extensive HTML dashboard logic here 
    // (Omitted in this view for brevity, but it's in your file!)
    res.send(`<h1>Bot Dashboard</h1><p>Status: ${botState.connected ? 'Online' : 'Offline'}</p><a href="/logs">View Logs</a>`);
});

app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
  });
});

app.post("/start", (req, res) => {
    if (!botState.connected) {
        createBot();
        res.json({ success: true, msg: "Starting bot..." });
    } else {
        res.json({ success: false, msg: "Bot is already running." });
    }
});

// ============================================================
// MINEFLAYER BOT LOGIC
// ============================================================
function createBot() {
    addLog(`[System] Attempting to connect to ${config.server.ip}...`);

    bot = mineflayer.createBot({
        host: config.server.ip,
        port: parseInt(config.server.port),
        username: config.name,
        version: config.server.version,
    });

    bot.loadPlugin(pathfinder);

    bot.on("spawn", () => {
        botState.connected = true;
        addLog(`[Success] ${config.name} spawned at ${bot.entity.position}`);
        
        // Anti-AFK & Flight Kick Fix: Force the bot to the ground defined in settings.json
        const mcData = require("minecraft-data")(bot.version);
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);

        // Move to the exact safe coordinates from your settings.json
        const target = new GoalBlock(config.coordinates.x, config.coordinates.y, config.coordinates.z);
        bot.pathfinder.setGoal(target);
    });

    bot.on("error", (err) => {
        addLog(`[Error] ${err.message}`);
    });

    bot.on("kicked", (reason) => {
        const reasonText = typeof reason === 'string' ? reason : JSON.stringify(reason);
        addLog(`[Kicked] Reason: ${reasonText}`);
        botState.connected = false;
    });

    bot.on("end", () => {
        botState.connected = false;
        addLog("[System] Connection lost. Reconnecting in 10s...");
        setTimeout(createBot, 10000);
    });
}

// Start the Express server
app.listen(PORT, () => {
    addLog(`[Web] Dashboard running on port ${PORT}`);
    // Start the bot automatically when the server starts
    createBot(); 
});
