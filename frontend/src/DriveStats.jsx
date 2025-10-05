import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import HeatmapView from "./HeatmapView";
import "/styles/DriveStats.css";

export default function DriveStats() {
  const navigate = useNavigate();
  const earnerId = "E10000";

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          <button className="btn-link" onClick={() => navigate("/dashboard")}>Home</button>
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
            <HeatmapView />
          </div>
        </section>

        <aside className="cards-grid">
          <div className="kpi-card card-surface">
            <div className="kpi-label">Potential income</div>
            <div className="kpi-value">3 km</div>
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
            <div className="kpi-label">Avg. Rider Rating</div>
            <div className="kpi-value">{loading ? "Loading…" : summary?.avg_rating?.toFixed(2) ?? "—"}★</div>
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
