/*  public/app.js  --------------------------------------------------
   Small client-side helper for SmartMonitor dashboard
   – Polls the Azure Function every 5 s
   – Updates KPI cards
   – Feeds a Chart.js CO₂ line chart
   – No build step required (vanilla JS)
-------------------------------------------------------------------*/

// 1️⃣  CHANGE this to the real Function URL once your teammate deploys
const API = "https://<FUNCTION-APP>.azurewebsites.net/api/latest?count=100";

// 2️⃣  Grab references to the existing <span> elements in dashboard.html
const deskSpan   = document.getElementById("desk-occupied");
const co2Span    = document.getElementById("co2-level");
const roomSpan   = document.getElementById("room-temp");
const lightsSpan = document.getElementById("light-status");

// 3️⃣  Build the CO₂ Trend chart ------------------------------------------------
const ctx = document.getElementById("co2Trend").getContext("2d");
const co2Chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],                     // x-axis timestamps
    datasets: [{
      label: "CO₂ (ppm)",
      data: [],                     // y-axis ppm
      tension: 0.3,
      fill: false,
      pointRadius: 3,
      borderWidth: 2
    }]
  },
  options: {
    scales: {
      x: { ticks: { autoSkip: true, maxTicksLimit: 6 } },
      y: { beginAtZero: false }
    },
    plugins: { legend: { display: false } }
  }
});

// 4️⃣  Polling function ---------------------------------------------------------
async function refresh() {
  try {
    const res  = await fetch(API);
    if (!res.ok) throw new Error(res.statusText);
    const rows = await res.json();          // newest first (cloud Function logic)

    if (!rows.length) return;               // no data yet

    // ----- KPI cards (use newest row) -----
    const r0 = rows[0];
    deskSpan.textContent   = r0.occupied ? "Yes" : "No";
    co2Span.textContent    = `${r0.co2ppm} ppm`;
    roomSpan.textContent   = `${r0.roomTemp} °C`;
    lightsSpan.textContent = r0.lightOn ? "On" : "Off";

    // ----- CO₂ line chart (last 12 points) -----
    const co2pts = rows
      .filter(r => r.co2ppm !== undefined)
      .slice(0, 12)                        // most recent 12
      .reverse();                          // chronological

    co2Chart.data.labels = co2pts.map(r =>
      new Date(r.ts * 1000).toLocaleTimeString([], {hour12:false, minute:"2-digit", second:"2-digit"}));
    co2Chart.data.datasets[0].data = co2pts.map(r => r.co2ppm);
    co2Chart.update();

  } catch (err) {
    console.error("Dashboard refresh error:", err);
  }
}

// 5️⃣  Kick off once immediately, then every 5 s
refresh();
setInterval(refresh, 5000);
