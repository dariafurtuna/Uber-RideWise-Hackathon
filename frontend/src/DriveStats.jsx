import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import HeatmapView from "./HeatmapView";
import "/styles/DriveStats.css";
import HeatmapTimeline from "./HeatmapTimeline";

export default function DriveStats() {
  const navigate = useNavigate();
  const earnerId = "d42";

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const WORK_KEY = "workSessionStartedAt";
  const [sessionStartedAt, setSessionStartedAt] = useState(() => {
  const raw = localStorage.getItem(WORK_KEY);
  return raw ? Number(raw) : null;
});
const [nowTick, setNowTick] = useState(Date.now());

  function formatHMS(ms) {
    const secs = Math.max(0, Math.floor(ms / 1000));
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
} 
  
  useEffect(() => {
    const onWorkSession = (e) => {
      if (e.detail?.active) {
        setSessionStartedAt(e.detail.startedAt);
      } else {
        setSessionStartedAt(null);
      }
    };
    window.addEventListener("workSession", onWorkSession);

    const t = setInterval(() => setNowTick(Date.now()), 1000); // 1s tick
    return () => {
      window.removeEventListener("workSession", onWorkSession);
      clearInterval(t);
    };
  }, []);

  const elapsedMs = sessionStartedAt ? Math.max(0, nowTick - sessionStartedAt) : 0;
const elapsedHours = elapsedMs / 3_600_000;

const earningsPerHour =
  !loading && summary?.today_earnings != null && elapsedHours > 0
    ? summary.today_earnings / elapsedHours
    : null;


  useEffect(() => {
    let alive = true;
    async function fetchSummary() {
      try {
        const res = await fetch(`http://localhost:8000/earners/${earnerId}/today_summary`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!alive) return;
        setSummary(data);
      } catch (e) {
        setError(e.message || "Failed to fetch");
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
    const id = setInterval(fetchSummary, 20000);
    return () => { alive = false; clearInterval(id); };
  }, [earnerId]);

  // Listen for rideCompleted event to instantly refresh dashboard
  useEffect(() => {
    function handleRideCompleted() {
      // Optimistic update
      setSummary(prev => prev ? {
        ...prev,
        today_earnings: (prev.today_earnings ?? 0) + 5,
        rides_completed: (prev.rides_completed ?? 0) + 1
      } : prev);
      // Fetch real data
      fetch(`http://localhost:8000/earners/${earnerId}/today_summary`)
        .then(r => r.json())
        .then(setSummary)
        .catch(console.error);
    }
    window.addEventListener("rideCompleted", handleRideCompleted);
    return () => window.removeEventListener("rideCompleted", handleRideCompleted);
  }, [earnerId]);

  const formatEuro = (v) =>
    v == null
      ? "—"
      : Number(v).toLocaleString(undefined, { style: "currency", currency: "EUR" });

  return (
    <div className="uber-shell">
      <nav className="topbar">
        <div className="brand">Uber</div>
        <div className="spacer" />
        <div className="nav-items">
          <button className="btn-link" onClick={() => navigate("/drive-stats")}>Home</button>
          <button className="btn-link" onClick={() => navigate("/driver")}>My Rides</button>
        </div>
      </nav>

      <main className="dashboard">
        <section className="map-panel card-surface">
          <div className="panel-head">
            <h1 className="page-title">Heat Zones</h1>
            <div className="panel-sub">Tap on map to move center · Adjust radius to explore</div>
          </div>
          <div className="map-wrap">
            <HeatmapTimeline />
          </div>
        </section>

        <aside className="cards-grid">
          <div className="kpi-card card-surface" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
  <div className="kpi-label">Time on shift</div>

  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div className="kpi-value">
      {sessionStartedAt ? formatHMS(elapsedMs) : "—"}
    </div>

    {sessionStartedAt && (
      <button
        className="btn-secondary"
        onClick={() => {
          localStorage.removeItem("workSessionStartedAt");
          window.dispatchEvent(new CustomEvent("workSession", { detail: { active: false } }));
          navigate("/");
        }}
        style={{
          marginLeft: "12px",
          padding: "6px 10px",
          borderRadius: "6px",
          border: "none",
          background: "#eee",
          cursor: "pointer",
          fontSize: "0.9rem",
        }}
      >
        End Shift
      </button>
    )}
  </div>

  <div className="kpi-sub">
    {sessionStartedAt ? "Since you pressed Start" : "Press Start on Home"}
  </div>
</div>



          <div className="kpi-card card-surface">
            <div className="kpi-label">Income Today</div>
            <div className="kpi-value">{loading ? "Loading…" : formatEuro(summary?.today_earnings)}</div>
          </div>

          <div className="kpi-card card-surface">
            <div className="kpi-label">Rides Completed</div>
            <div className="kpi-value">{loading ? "Loading…" : summary?.rides_completed ?? "—"}</div>
          </div>

          <div className="kpi-card card-surface">
            <div className="kpi-label">Earnings / hour</div>
              <div className="kpi-value">
                {earningsPerHour != null ? formatEuro(earningsPerHour) : "—"}
              </div>
            <div className="kpi-sub">Based on today’s earnings</div>
          </div>

          <div className="kpi-card card-surface">
            <div className="kpi-label">Recommendations</div>
            <div className="kpi-sub">Smart suggestions for your next trip</div>
            <button className="btn-primary" onClick={() => navigate("/wellness")}>
              Get Recommendations
            </button>
          </div>
        </aside>
      {error && (
        <div style={{ color: "red", textAlign: "center", marginTop: 10 }}>
          ⚠ {String(error)}
        </div>
      )}
      </main>
    </div>
  );
}
