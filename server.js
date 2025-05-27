// server.js (FINAL REVISED VERSION)
const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");
require('dotenv').config();

const app = express();
const fetch = require('node-fetch');
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const mongoUri = process.env.MONGO_CONNECTION_STRING;
const dbName = "iot-assignment";

let db, eventsCollection, settingsCollection;

let lastDiscordAlertTime = 0;
const DISCORD_ALERT_COOLDOWN = 6 * 1000;
let lastPostureAlertTime = 0;
const POSTURE_ALERT_COOLDOWN = 6 * 1000;

async function sendDiscordAlert(message) {
  await fetch(process.env.DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message })
  });
}

async function connectToMongo() {
  const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
  await client.connect();
  db = client.db(dbName);
  eventsCollection = db.collection("events");
  settingsCollection = db.collection("settings");
  console.log("Connected to MongoDB");

  await settingsCollection.updateOne(
    { _id: "globalSettings" },
    {
      $setOnInsert: {
        co2Threshold: 800,
        breakInterval: 45,
        muteAlerts: false
      }
    },
    { upsert: true }
  );
}

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/analytics", (req, res) => res.sendFile(path.join(__dirname, "public", "analytics.html")));
app.get("/settings", (req, res) => res.sendFile(path.join(__dirname, "public", "settings.html")));

app.get("/api/analytics-data", async (req, res) => {
  try {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const events = await eventsCollection.find({ timestamp: { $gte: tenMinsAgo }, type: "desk" }).toArray();

    const minuteBuckets = {};
    events.forEach(e => {
      const minute = e.timestamp.toISOString().slice(0, 16);
      if (!minuteBuckets[minute]) minuteBuckets[minute] = { break: 0, count: 0 };
      if (e.event.breakSecs) minuteBuckets[minute].break += e.event.breakSecs / 60;
      minuteBuckets[minute].count++;
    });

    const labels = [], breakDurations = [];
    for (const [minute, vals] of Object.entries(minuteBuckets)) {
      labels.push(minute.slice(11));
      breakDurations.push(vals.break);
    }

    const totalExits = events.filter(e => e.event.exit).length;
    const totalBreak = events.reduce((sum, e) => sum + (e.event.breakSecs || 0), 0);
    const totalPostureOk = events.filter(e => e.event.posture === "ok").length;
    const totalCO2 = events.reduce((sum, e) => sum + (e.event.co2 || 0), 0);
    const count = events.length;

    res.json({
      totalExits,
      avgBreak: count ? Math.round(totalBreak / 60 / count) : 0,
      postureOk: count ? Math.round((totalPostureOk / count) * 100) : 0,
      avgCO2: count ? Math.round(totalCO2 / count) : 0,
      chart: { labels, breakDurations }
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

app.get("/api/dashboard-data", async (req, res) => {
  try {
    const event = await eventsCollection.findOne({ type: "desk" }, { sort: { timestamp: -1 } });
    if (!event) return res.status(404).json({ error: "No data yet" });

    const dashboardData = {
      deskOccupied: event.event.presence ?? false,
      co2: event.event.co2,
      roomTemp: event.event.temperature,
      lightOn: true,
      outdoorTemp: (Math.random() * 15 + 10).toFixed(1),
      outdoorAqi: Math.floor(Math.random() * 80) + 20,
      co2Trend: [],
      occTimeline: [],
      posture: event.event.posture ?? "ok"
    };

    const pastEvents = await eventsCollection.find({ type: "desk" }).sort({ timestamp: -1 }).limit(6).toArray();
    dashboardData.co2Trend = pastEvents.map(e => e.event.co2);
    dashboardData.occTimeline = pastEvents.map(e => e.event.presence ? 1 : 0);

    const settings = await settingsCollection.findOne({ _id: "globalSettings" }) || {};
    const threshold = settings.co2Threshold || 800;

    if (dashboardData.co2 > threshold && !settings.muteAlerts && Date.now() - lastDiscordAlertTime > DISCORD_ALERT_COOLDOWN) {
      await sendDiscordAlert(`🚨 **CO₂ Alert:** Level is ${dashboardData.co2} ppm at your desk!`);
      lastDiscordAlertTime = Date.now();
    }

    if (dashboardData.deskOccupied && dashboardData.posture === "bad" && !settings.muteAlerts && Date.now() - lastPostureAlertTime > POSTURE_ALERT_COOLDOWN) {
      await sendDiscordAlert(`⚠️ **Posture Alert:** Bad posture detected at your desk!`);
      lastPostureAlertTime = Date.now();
    }

    res.json(dashboardData);
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

app.post("/api/report", async (req, res) => {
  try {
    const { seatedSecs, breakSecs, temperature, co2, timestamp } = req.body;

    if (
      typeof seatedSecs !== "number" ||
      typeof breakSecs !== "number" ||
      typeof temperature !== "number" ||
      typeof co2 !== "number"
    ) {
      return res.status(400).json({ error: "Invalid data format" });
    }

    const report = {
      type: "desk",
      deviceId: "desk-001",
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      event: {
        seatedSecs,
        breakSecs,
        temperature,
        co2
      }
    };

    await eventsCollection.insertOne(report);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Failed to insert report:", err);
    res.status(500).json({ error: "Failed to save report" });
  }
});

app.get("/api/reports", async (req, res) => {
  try {
    const reports = await eventsCollection.find({ type: "desk" }).sort({ timestamp: -1 }).limit(10).toArray();
    res.json(reports);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

connectToMongo().then(() => {
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
});
