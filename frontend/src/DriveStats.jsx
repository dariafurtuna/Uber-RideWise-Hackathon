import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import HeatmapView from "./HeatmapView";
import "/styles/DriveStats.css";

export default function DriveStats() {
  const navigate = useNavigate();
  const earnerId = "E10000";

  const [todayEarnings, setTodayEarnings] = useState(null);
  const [todayTime, setTodayTime] = useState(null);

  useEffect(() => {
    api.earnerToday(earnerId)
      .then((data) => setTodayEarnings(data.today_earnings))
      .catch((err) => console.error("Failed to load today's earnings", err));

    api.earnerTodayTime(earnerId)
      .then((data) => setTodayTime(data.today_time_hours))
      .catch((err) => console.error("Failed to load today's driving time", err));
  }, [earnerId]);

  const formatEuro = (v) =>
    v == null
      ? "—"
      : Number(v).toLocaleString(undefined, { style: "currency", currency: "EUR" });

  const formatHours = (h) => {
    if (h == null) return "—";
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")} hrs`;
  };

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
            <div className="kpi-value">{todayEarnings === null ? "Loading…" : formatEuro(todayEarnings)}</div>
          </div>

          <div className="kpi-card card-surface">
            <div className="kpi-label">Elapsed Time</div>
            <div className="kpi-value">{todayTime === null ? "Loading…" : formatHours(todayTime)}</div>
          </div>

          <div className="kpi-card card-surface">
            <div className="kpi-label">Recommendations</div>
            <div className="kpi-sub">Smart suggestions for your next trip</div>
            <button className="btn-primary" onClick={() => navigate("/wellness")}>
              Get Recommendations
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}
