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
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db(dbName);
    eventsCollection = db.collection("events");
    settingsCollection = db.collection("settings");
    console.log("✅ Connected to MongoDB");

    // Ensure settings doc exists
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
  } catch (err) {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  }
}

//── Static Page Routes ──
app.get("/",       (req, res) => res.sendFile(path.join(__dirname, "public/dashboard.html")));
app.get("/analytics", (req, res) => res.sendFile(path.join(__dirname, "public/analytics.html")));
app.get("/settings",  (req, res) => res.sendFile(path.join(__dirname, "public/settings.html")));

//── API: Ingest ESP Reports ──
app.post("/api/report", async (req, res) => {
  const { seatedSecs, breakSecs, temperature, co2, timestamp } = req.body;
  if (
    typeof seatedSecs !== "number" ||
    typeof breakSecs  !== "number" ||
    typeof temperature !== "number" ||
    typeof co2 !== "number"
  ) {
    return res.status(400).json({ error: "Invalid data format" });
  }

  const report = {
    type: "desk",
    deviceId: "desk-001",
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    event: { seatedSecs, breakSecs, temperature, co2 }
  };

  try {
    await eventsCollection.insertOne(report);
    res.json({ success: true });
  } catch (err) {
    console.error("Failed to insert report:", err);
    res.status(500).json({ error: "Failed to save report" });
  }
});

//── API: Dashboard Data ──
app.get("/api/dashboard-data", async (req, res) => {
  try {
    const latest = await eventsCollection.findOne(
      { type: "desk" },
      { sort: { timestamp: -1 } }
    );
    if (!latest) return res.status(404).json({ error: "No data yet" });

    // pull last 6 events for trends
    const recent = await eventsCollection
      .find({ type: "desk" })
      .sort({ timestamp: -1 })
      .limit(6)
      .toArray();

    // fetch settings
    const settings = await settingsCollection.findOne({ _id: "globalSettings" });

    const dashboardData = {
      deskOccupied: latest.event.presence ?? false,
      co2: latest.event.co2,
      roomTemp: latest.event.temperature,
      lightOn: true,
      outdoorTemp: (Math.random() * 15 + 10).toFixed(1),
      outdoorAqi: Math.floor(Math.random() * 80) + 20,
      posture: latest.event.posture ?? "ok",
      co2Trend: recent.map(e => e.event.co2),
      occTimeline: recent.map(e => (e.event.presence ? 1 : 0))
    };

    // send alerts if needed (omitted here; reuse your Discord code)

    res.json(dashboardData);
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

//── API: Analytics Data ──
app.get("/api/analytics-data", async (req, res) => {
  try {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const events = await eventsCollection
      .find({ timestamp: { $gte: tenMinsAgo }, type: "desk" })
      .toArray();

    // bucket by minute
    const minuteBuckets = {};
    events.forEach(e => {
      const minute = e.timestamp.toISOString().slice(0, 16);
      if (!minuteBuckets[minute]) minuteBuckets[minute] = { break: 0, count: 0 };
      minuteBuckets[minute].break += e.event.breakSecs || 0;
      minuteBuckets[minute].count++;
    });

    const labels = [], breakDurations = [];
    for (const [minute, vals] of Object.entries(minuteBuckets)) {
      labels.push(minute.slice(11));
      breakDurations.push(vals.break);
    }

    const totalExits    = events.filter(e => e.event.exit).length;
    const totalBreak    = events.reduce((sum,e)=> sum + (e.event.breakSecs||0),0);
    const totalPostureOk= events.filter(e=> e.event.posture==="ok").length;
    const totalCO2      = events.reduce((sum,e)=> sum + (e.event.co2||0),0);
    const count         = events.length;

    res.json({
      totalExits,
      avgBreak: count ? Math.round(totalBreak / count) : 0,
      postureOk: count ? Math.round((totalPostureOk / count) * 100) : 0,
      avgCO2: count ? Math.round(totalCO2 / count) : 0,
      chart: { labels, breakDurations }
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

//── API: Settings ──
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
    const { co2Threshold, breakInterval, muteAlerts } = req.body;
    await settingsCollection.updateOne(
      { _id: "globalSettings" },
      { $set: { co2Threshold, breakInterval, muteAlerts } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Settings save error:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

//── Start Server ──
connectToMongo().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
