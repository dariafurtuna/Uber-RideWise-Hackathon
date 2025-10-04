import { useEffect, useState } from "react";
import { api } from "./api";
import "./DriveStats.css";

export default function DriveStats() {
  const earnerId = "E10000"; // Example ID — in production you’d detect this dynamically
  const [todayEarnings, setTodayEarnings] = useState(null);

  useEffect(() => {
    api.earnerToday(earnerId)
      .then((data) => setTodayEarnings(data.today_earnings))
      .catch((err) => console.error("Failed to load today's earnings", err));
  }, [earnerId]);

  const formatEuro = (v) =>
    v == null ? "—" : Number(v).toLocaleString(undefined, { style: "currency", currency: "EUR" });

  return (
    <div className="uber-shell">
      <nav className="topbar">
        <div className="brand">Uber</div>
        <div className="spacer" />
        <div className="nav-items">
          <span>Dashboard</span>
          <span>Earnings</span>
          <span>Hotspots</span>
        </div>
      </nav>

      <main className="dashboard">
        <section className="map-panel">
          <div className="map-inner">
            <h2>Map</h2>
            <p>Integrated from another branch</p>
          </div>
        </section>

        <aside className="cards-grid">
          <div className="card">
            <h3>Nearest Hotspot</h3>
            <p className="value">0.5 km</p>
            <button className="btn btn-green">Drive</button>
          </div>

          <div className="card">
            <h3>Income Today</h3>
            <p className="value">
              {todayEarnings === null ? "Loading…" : formatEuro(todayEarnings)}
            </p>
          </div>

          <div className="card">
            <h3>Elapsed Time</h3>
            <p className="value">04:25 hrs</p>
          </div>

          <div className="card">
            <h3>Recommendations</h3>
            <p className="muted">Smart suggestions for your next trip</p>
            <button className="btn btn-blue">Get Recommendations</button>
          </div>
        </aside>
      </main>
    </div>
  );
}
