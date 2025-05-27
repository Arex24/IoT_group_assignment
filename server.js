<<<<<<< HEAD
// server.js
=======
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for JSON parsing
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const mongoUri = process.env.MONGO_CONNECTION_STRING;
const dbName = "iot-assignment";

let db, eventsCollection, settingsCollection;

<<<<<<< HEAD
// cooldown timers for Discord alerts (if you use them)
=======
// Discord alert cooldown variables
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
let lastDiscordAlertTime = 0;
const DISCORD_ALERT_COOLDOWN = 6 * 1000; // 6 seconds for demo/testing

<<<<<<< HEAD
// require.env checks
if (!mongoUri) {
  console.error("Error: MONGO_CONNECTION_STRING is not set");
  process.exit(1);
}
if (!process.env.DISCORD_WEBHOOK_URL) {
  console.error("Error: DISCORD_WEBHOOK_URL is not set");
  process.exit(1);
}

// optional: wrap fetch in a try/catch
=======
let lastPostureAlertTime = 0;
const POSTURE_ALERT_COOLDOWN = 6 * 1000; // 6 seconds for demo/testing

// Helper function to generate a random event
function generateRandomEvent() {
  const now = new Date();
  return {
    deviceId: "desk-001",
    type: Math.random() > 0.5 ? "desk" : "door",
    timestamp: now,
    event: {
      presence: Math.random() > 0.2,
      posture: Math.random() > 0.65 ? "ok" : "bad",
      co2: Math.floor(Math.random() * 400) + 400,
      temperature: Math.floor(Math.random() * 10) + 20,
      breakMinutes: Math.floor(Math.random() * 30) + 10,
      exit: Math.random() > 0.7
    }
  };
}

// Helper function to send Discord alert
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
async function sendDiscordAlert(message) {
  try {
    const res = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
    if (!res.ok) {
      console.error("Discord webhook error:", res.status, res.statusText);
    }
  } catch (e) {
    console.error("Error sending Discord alert:", e);
  }
}

async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db(dbName);
    eventsCollection = db.collection("events");
    settingsCollection = db.collection("settings");
    console.log("Connected to MongoDB");

<<<<<<< HEAD
    // ensure a globalSettings document exists
    await settingsCollection.updateOne(
      { _id: "globalSettings" },
      {
        $setOnInsert: {
          co2Threshold: 800,
          breakInterval: 45,
          muteAlerts: false,
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

// serve static pages
app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "dashboard.html"))
);
app.get("/analytics", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "analytics.html"))
);
app.get("/settings", (req, res) =>
  res.sendFile(path.join(__dirname, "public", "settings.html"))
);

// new: return your settings document
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await settingsCollection.findOne({ _id: "globalSettings" });
    if (!settings) {
      return res.status(404).json({ error: "Settings not found" });
    }
    res.json(settings);
  } catch (err) {
    console.error("Settings fetch error:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// analytics data
app.get("/api/analytics-data", async (req, res) => {
  try {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const events = await eventsCollection
      .find({ timestamp: { $gte: tenMinsAgo }, type: "desk" })
      .toArray();

    const minuteBuckets = {};
    events.forEach((e) => {
      const minute = e.timestamp.toISOString().slice(0, 16);
=======
  // Initialize default settings if none exist
  const defaultSettings = {
    _id: "globalSettings",
    co2Threshold: 800,
    breakInterval: 45,
    muteAlerts: false
  };
  
  await settingsCollection.updateOne(
    { _id: "globalSettings" },
    { $setOnInsert: defaultSettings },
    { upsert: true }
  );

  // Start periodic data insertion
  setInterval(async () => {
    const randomEvent = generateRandomEvent();
    await eventsCollection.insertOne(randomEvent);
  }, 60000);

  // Initial batch insertion
  const now = new Date();
  for (let i = 0; i < 7 * 24; i++) {
    const event = generateRandomEvent();
    event.timestamp = new Date(now.getTime() - i * 60 * 60 * 1000);
    await eventsCollection.insertOne(event);
  }
}

// ----------- Routes -----------
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/analytics", (req, res) => res.sendFile(path.join(__dirname, "public", "analytics.html")));
app.get("/settings", (req, res) => res.sendFile(path.join(__dirname, "public", "settings.html")));

// ----------- API Endpoints -----------

// Analytics endpoint
app.get("/api/analytics-data", async (req, res) => {
  try {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const events = await eventsCollection.find({
      timestamp: { $gte: tenMinsAgo }
    }).toArray();

    // Group by minute
    let minuteBuckets = {};
    events.forEach(e => {
      const minute = e.timestamp.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
      if (!minuteBuckets[minute]) minuteBuckets[minute] = { break: 0, count: 0 };
      if (e.event.breakMinutes) minuteBuckets[minute].break += e.event.breakMinutes;
      minuteBuckets[minute].count += 1;
    });

<<<<<<< HEAD
    const labels = [];
    const breakDurations = [];
    for (const [minute, vals] of Object.entries(minuteBuckets)) {
      labels.push(minute.slice(11));
=======
    let labels = [], breakDurations = [];
    Object.entries(minuteBuckets).forEach(([minute, vals]) => {
      labels.push(minute.slice(11)); // "HH:MM"
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
      breakDurations.push(vals.break);
    });

<<<<<<< HEAD
    const totalExits = events.filter((e) => e.event.exit).length;
    const totalBreak = events.reduce((sum, e) => sum + (e.event.breakSecs || 0), 0);
    const totalPostureOk = events.filter((e) => e.event.posture === "ok").length;
=======
    // For summary cards, use all events in last 10 minutes
    const totalExits = events.filter(e => e.type === "door" && e.event.exit).length;
    const totalBreak = events.reduce((sum, e) => sum + (e.event.breakMinutes || 0), 0);
    const totalPostureOk = events.filter(e => e.event.posture === "ok").length;
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
    const totalCO2 = events.reduce((sum, e) => sum + (e.event.co2 || 0), 0);
    const count = events.length;

    res.json({
      totalExits,
      avgBreak: count ? Math.round(totalBreak / count) : 0,
      postureOk: count ? Math.round((totalPostureOk / count) * 100) : 0,
      avgCO2: count ? Math.round(totalCO2 / count) : 0,
<<<<<<< HEAD
      chart: { labels, breakDurations },
=======
      chart: {
        labels,
        breakDurations
      }
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

<<<<<<< HEAD
// dashboard data
=======
// Dashboard endpoint with automatic Discord alert
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
app.get("/api/dashboard-data", async (req, res) => {
  const event = generateRandomEvent();
  const dashboardData = {
    deskOccupied: event.event.presence,
    co2: event.event.co2,
    roomTemp: event.event.temperature,
    lightOn: Math.random() > 0.3,
    outdoorTemp: (Math.random() * 15 + 10).toFixed(1),
    outdoorAqi: Math.floor(Math.random() * 80) + 20,
    co2Trend: Array.from({length: 6}, () => generateRandomEvent().event.co2),
    occTimeline: Array.from({length: 6}, () => generateRandomEvent().event.presence ? 1 : 0),
    posture: event.event.posture // <-- add posture to dashboard data
  };

  // Fetch user settings for threshold
  try {
<<<<<<< HEAD
    const event = await eventsCollection.findOne(
      { type: "desk" },
      { sort: { timestamp: -1 } }
    );
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
      posture: event.event.posture ?? "ok",
    };

    const pastEvents = await eventsCollection
      .find({ type: "desk" })
      .sort({ timestamp: -1 })
      .limit(6)
      .toArray();
    dashboardData.co2Trend = pastEvents.map((e) => e.event.co2);
    dashboardData.occTimeline = pastEvents.map((e) =>
      e.event.presence ? 1 : 0
    );

    const settings =
      (await settingsCollection.findOne({ _id: "globalSettings" })) || {};
    const threshold = settings.co2Threshold || 800;

    // optional Discord alerts
    if (
      dashboardData.co2 > threshold &&
      !settings.muteAlerts &&
      Date.now() - lastDiscordAlertTime > DISCORD_ALERT_COOLDOWN
    ) {
      await sendDiscordAlert(
        `🚨 **CO₂ Alert:** Level is ${dashboardData.co2} ppm at your desk!`
      );
      lastDiscordAlertTime = Date.now();
    }
    if (
      dashboardData.deskOccupied &&
      dashboardData.posture === "bad" &&
      !settings.muteAlerts &&
      Date.now() - lastPostureAlertTime > POSTURE_ALERT_COOLDOWN
    ) {
      await sendDiscordAlert(
        `⚠️ **Posture Alert:** Bad posture detected at your desk!`
      );
      lastPostureAlertTime = Date.now();
    }

    res.json(dashboardData);
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

// report ingestion
app.post("/api/report", async (req, res) => {
  try {
    const { seatedSecs, breakSecs, temperature, co2, timestamp } = req.body;
=======
    const settings = await settingsCollection.findOne({ _id: "globalSettings" });
    const threshold = settings?.co2Threshold || 800;

    // --- CO₂ Alert ---
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
    if (
      dashboardData.co2 > threshold &&
      (!settings.muteAlerts) &&
      Date.now() - lastDiscordAlertTime > DISCORD_ALERT_COOLDOWN
    ) {
      try {
        await sendDiscordAlert(`🚨 **CO₂ Alert:** Level is ${dashboardData.co2} ppm at your desk!`);
        lastDiscordAlertTime = Date.now();
        console.log("Discord alert sent!");
      } catch (err) {
        console.error("Failed to send Discord alert:", err);
      }
    }

<<<<<<< HEAD
    const report = {
      type: "desk",
      deviceId: "desk-001",
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      event: { seatedSecs, breakSecs, temperature, co2 },
    };

    await eventsCollection.insertOne(report);
    res.json({ success: true });
=======
    // --- Posture Alert ---
    if (
      dashboardData.deskOccupied && // Only alert if someone is at the desk
      dashboardData.posture === "bad" &&
      (!settings.muteAlerts) &&
      Date.now() - lastPostureAlertTime > POSTURE_ALERT_COOLDOWN
    ) {
      try {
        await sendDiscordAlert(`⚠️ **Posture Alert:** Bad posture detected at your desk!`);
        lastPostureAlertTime = Date.now();
        console.log("Posture alert sent!");
      } catch (err) {
        console.error("Failed to send Discord posture alert:", err);
      }
    }

>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
  } catch (err) {
    console.error("Settings fetch error (for Discord alert):", err);
    // Continue anyway
  }

  res.json(dashboardData);
});

<<<<<<< HEAD
// recent reports
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await eventsCollection
      .find({ type: "desk" })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();
    res.json(reports);
  } catch (err) {
    console.error("Failed to fetch reports:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// start server on all interfaces
=======
// User settings endpoints
app.get("/api/settings", async (req, res) => {
  try {
    const settings = await settingsCollection.findOne({ _id: "globalSettings" });
    res.json(settings);
  } catch (err) {
    console.error("Settings fetch error:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const result = await settingsCollection.updateOne(
      { _id: "globalSettings" },
      { $set: req.body },
      { upsert: true }
    );
    res.json({ success: result.acknowledged });
  } catch (err) {
    console.error("Settings save error:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// Manual Discord alert endpoint (optional)
app.post('/api/send-discord-alert', express.json(), async (req, res) => {
  const { message } = req.body;
  try {
    const response = await fetch(process.env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message })
    });
    if (!response.ok) throw new Error('Discord webhook failed');
    res.json({ success: true });
  } catch (err) {
    console.error('Discord webhook error:', err);
    res.status(500).json({ error: 'Failed to send Discord alert' });
  }
});

// ----------- Start Server -----------
>>>>>>> 00988b7e6f9bfb03a426f298e5723f592bafb8d1
connectToMongo().then(() => {
  app.listen(PORT, "0.0.0.0", () =>
    console.log(`Server running on port ${PORT}`)
  );
});
