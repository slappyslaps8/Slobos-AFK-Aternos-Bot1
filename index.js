"use strict";

const { addLog, getLogs } = require("./logger");
const mineflayer = require("mineflayer");
const { Movements, pathfinder, goals } = require("mineflayer-pathfinder");
const { GoalBlock } = goals;
const config = require("./settings.json");
const express = require("express");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000; 

let bot;
let botState = {
  connected: false,
  startTime: Date.now(),
};

// Dashboard Route
app.get('/', (req, res) => {
    res.send(`<h1>Bot Dashboard</h1><p>Status: ${botState.connected ? 'Online' : 'Offline'}</p><a href="/logs">View Logs</a>`);
});

app.get("/health", (req, res) => {
  res.json({
    status: botState.connected ? "connected" : "disconnected",
    uptime: Math.floor((Date.now() - botState.startTime) / 1000),
    coords: bot && bot.entity ? bot.entity.position : null,
  });
});

function createBot() {
    addLog(`[System] Attempting to connect to ${config.server.ip}:${config.server.port}...`);

    bot = mineflayer.createBot({
        host: config.server.ip,
        port: parseInt(config.server.port),
        // Use the actual username from your JSON
        username: config["bot-account"].username, 
        version: config.server.version,
    });

    bot.loadPlugin(pathfinder);

    bot.on("spawn", () => {
        botState.connected = true;
        addLog(`[Success] ${config["bot-account"].username} spawned!`);
        
        const mcData = require("minecraft-data")(bot.version);
        const movements = new Movements(bot, mcData);
        bot.pathfinder.setMovements(movements);

        // Fixed: Matching your JSON key "position"
        const target = new GoalBlock(config.position.x, config.position.y, config.position.z);
        bot.pathfinder.setGoal(target);
    });

    bot.on("error", (err) => addLog(`[Error] ${err.message}`));

    bot.on("kicked", (reason) => {
        addLog(`[Kicked] ${reason}`);
        botState.connected = false;
    });

    bot.on("end", () => {
      botState.connected = false;
      addLog("[System] Reconnecting in 15s...");
      setTimeout(createBot, 15000);
    });
}

app.listen(PORT, () => {
    addLog(`[Web] Dashboard running on port ${PORT}`);
    createBot(); 
});
