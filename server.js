// server.js
const express = require("express");
const path = require("path");
const { MongoClient } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

//── Middleware ──
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

//── MongoDB Setup ──
const mongoUri = process.env.MONGO_CONNECTION_STRING;
if (!mongoUri) {
  console.error("❌ MONGO_CONNECTION_STRING not set");
  process.exit(1);
}

const dbName = "iot-assignment";
let db, eventsCollection, settingsCollection;

async function connectToMongo() {
  try {
    const client = new MongoClient(mongoUri, { useUnifiedTopology: true });
    await client.connect();
    db = client.db(dbName);
    eventsCollection = db.collection("events");
    settingsCollection = db.collection("settings");
    console.log("✅ Connected to MongoDB");

    // Ensure a globalSettings doc exists with a default temperature
    await settingsCollection.updateOne(
      { _id: "globalSettings" },
      { $setOnInsert: { setTemperature: 22.0 } },
      { upsert: true }
    );
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

//── Static File Routes ──
app.get("/",        (req, res) => res.sendFile(path.join(__dirname, "public/dashboard.html")));
app.get("/analytics",(req, res) => res.sendFile(path.join(__dirname, "public/analytics.html")));
app.get("/settings", (req, res) => res.sendFile(path.join(__dirname, "public/settings.html")));

//── Ingest Reports ──
app.post("/api/report", async (req, res) => {
  const { seatedSecs, breakSecs, temperature, co2, timestamp } = req.body;
  if ([seatedSecs, breakSecs, temperature, co2].some(x => typeof x !== "number")) {
    return res.status(400).json({ error: "Invalid data format" });
  }
  const report = {
    type:      "desk",
    deviceId:  "desk-001",
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    event:     { seatedSecs, breakSecs, temperature, co2 }
  };
  try {
    await eventsCollection.insertOne(report);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to insert report:", err);
    res.status(500).json({ error: "Failed to save report" });
  }
});

//── Fetch All Reports ──
app.get("/api/reports", async (req, res) => {
  try {
    const reports = await eventsCollection
      .find({ type: "desk" })
      .sort({ timestamp: 1 })
      .toArray();
    res.json(reports);
  } catch (err) {
    console.error("Failed to fetch reports:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

//── Dashboard Data ──
app.get("/api/dashboard-data", async (req, res) => {
  try {
    const latest = await eventsCollection.findOne({ type: "desk" }, { sort: { timestamp: -1 } });
    if (!latest) return res.status(404).json({ error: "No data yet" });

    const recent = await eventsCollection
      .find({ type: "desk" })
      .sort({ timestamp: -1 })
      .limit(6)
      .toArray();

    const dashboardData = {
      deskOccupied: latest.event.presence ?? false,
      co2:           latest.event.co2,
      roomTemp:      latest.event.temperature,
      lightOn:       true,
      outdoorTemp:   (Math.random() * 15 + 10).toFixed(1),
      outdoorAqi:    Math.floor(Math.random() * 80) + 20,
      posture:       latest.event.posture ?? "ok",
      co2Trend:      recent.map(e => e.event.co2),
      occTimeline:   recent.map(e => (e.event.presence ? 1 : 0))
    };

    res.json(dashboardData);
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

//── Analytics Data ──
app.get("/api/analytics-data", async (req, res) => {
  try {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const events = await eventsCollection
      .find({ timestamp: { $gte: tenMinsAgo }, type: "desk" })
      .toArray();

    const minuteBuckets = {};
    events.forEach(e => {
      const key = e.timestamp.toISOString().slice(0,16);
      if (!minuteBuckets[key]) minuteBuckets[key] = { break: 0 };
      minuteBuckets[key].break += e.event.breakSecs || 0;
    });

    const labels = [], breakDurations = [];
    for (const [minute, {break: b}] of Object.entries(minuteBuckets)) {
      labels.push(minute.slice(11));
      breakDurations.push(b);
    }

    const totalExits     = events.filter(e => e.event.exit).length;
    const totalBreak     = events.reduce((sum,e)=>sum+(e.event.breakSecs||0),0);
    const totalPostureOk = events.filter(e=>e.event.posture==="ok").length;
    const totalCO2       = events.reduce((sum,e)=>sum+(e.event.co2||0),0);
    const count          = events.length;

    res.json({
      totalExits,
      avgBreak:  count ? Math.round(totalBreak/count) : 0,
      postureOk: count ? Math.round((totalPostureOk/count)*100) : 0,
      avgCO2:    count ? Math.round(totalCO2/count) : 0,
      chart:     { labels, breakDurations }
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

//── Settings Endpoints ──
app.get("/api/settings", async (req, res) => {
  try {
    const doc = await settingsCollection.findOne({ _id: "globalSettings" });
    // if no doc, return default
    const temp = doc?.setTemperature ?? 22.0;
    res.json({ setTemperature: temp });
  } catch (err) {
    console.error("Settings fetch error:", err);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/settings", async (req, res) => {
  const { setTemperature } = req.body;
  if (typeof setTemperature !== "number") {
    return res.status(400).json({ error: "Invalid temperature format" });
  }
  try {
    await settingsCollection.updateOne(
      { _id: "globalSettings" },
      { $set: { setTemperature } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Settings save error:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

//── Start Server ──
connectToMongo().then(() => {
  app.listen(PORT, "0.0.0.0", () => console.log(` Server running on port ${PORT}`));
});
