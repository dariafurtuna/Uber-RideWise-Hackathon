import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getForecast } from "./api";
import "/styles/LandingPage.css";


const hourLabels = [
  "6AM", "7AM", "8AM", "9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM", "6PM", "7PM", "8PM"
];
const daysOfWeek = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

export default function LandingPage() {
  const [forecast, setForecast] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [surge, setSurge] = useState(null);
  const navigate = useNavigate();
  const [city, setCity] = useState(1);
  // Demo values for weather
  const weather = { icon: "🌥️", label: "Cloudy", desc: "Medium traffic expected" };
  const WORK_KEY = "workSessionStartedAt"; // ms timestamp

  const [working, setWorking] = useState(() => !!localStorage.getItem(WORK_KEY));

function startWork() {
  const t = Date.now();
  localStorage.setItem(WORK_KEY, String(t));
  setWorking(true);
  window.dispatchEvent(new CustomEvent("workSession", { detail: { active: true, startedAt: t } }));
}

function stopWork() {
  localStorage.removeItem(WORK_KEY);
  setWorking(false);
  window.dispatchEvent(new CustomEvent("workSession", { detail: { active: false } }));
}


  useEffect(() => {
    async function loadData() {
      try {
        const data = await getForecast(1, selectedDay);
        setForecast(data.forecast || []);
        setSurge(data.current_surge ?? null);
        setCity(data.city_name|| "");
      } catch (e) {
        console.error("Failed to fetch forecast", e);
      }
    }
    loadData();
  }, [selectedDay]);

  // Align forecast data to hourLabels (6AM-8PM)
  const hourRange = Array.from({ length: 15 }, (_, i) => i + 6); // 6 to 20
  const bars = hourRange.map(h => {
    const found = forecast.find(f => Number(f.hour) === h);
    return found || { eph: 0 };
  });
  const maxEph = Math.max(...bars.map(f => f.eph || 0), 1);
  // Dynamically generate y-axis labels based on maxEph
  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => Math.round((maxEph / (yTicks - 1)) * (yTicks - 1 - i)));

  return (
    <div className="lp-root">
      <h1 className="lp-main-title" style={{
        textAlign: 'center',
        fontWeight: 800,
        fontSize: '2.4rem',
        margin: '0 0 32px 0',
        letterSpacing: '0.01em',
        color: '#181818'
      }}>Smart Earner Assistant</h1>
      {/* Day navigation moved under the histogram */}
      <div className="lp-row">
        <div className="lp-card lp-weather">
          <div className="lp-weather-icon">{weather.icon}</div>
          <div className="lp-weather-title">{weather.label}</div>
          <div className="lp-weather-desc">{weather.desc}</div>
        </div>
        <div className="lp-card lp-surge">
          <div className="lp-surge-label">City Surge Level right now</div>
          <div className="lp-surge-value">{surge !== null ? `${Number(surge).toFixed(2)}x` : '--'}</div>
          <div className="lp-surge-bar-bg">
            <div className="lp-surge-bar-fg" style={{ width: `${surge ? Math.min(Number(surge) / 3, 1) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      <div className="lp-card lp-forecast">
        <div className="lp-forecast-title" style={{ marginBottom: 28, marginTop: -10 }}>Ride Demand Forecast for {city}</div>
        <div className="lp-forecast-chart-wrap">
          <div className="lp-forecast-yaxis">
            {yLabels.map((label, i) => (
              <div key={i}>{label}</div>
            ))}
          </div>
          <div className="lp-forecast-chart">
            {bars.map((f, i) => (
              <div key={i} className="lp-bar-col">
                <div
                  className="lp-bar"
                  style={{ height: `${(f.eph / maxEph) * 180 || 2}px` }}
                />
                <div className="lp-bar-label">{hourLabels[i]}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Day navigation arrows and label under the histogram */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '18px auto 0 auto', gap: 16 }}>
          <button
            aria-label="Previous day"
            className="lp-btn"
            style={{ width: 48, minWidth: 48, padding: 0, margin: 0, fontSize: 28, background: '#eee', color: '#222', borderRadius: 8 }}
            onClick={() => setSelectedDay((prev) => (prev + 6) % 7)}
          >
            &#8592;
          </button>
          <span className="lp-day-label" style={{ fontWeight: 600, fontSize: 22 }}>{daysOfWeek[selectedDay]}</span>
          <button
            aria-label="Next day"
            className="lp-btn"
            style={{ width: 48, minWidth: 48, padding: 0, margin: 0, fontSize: 28, background: '#eee', color: '#222', borderRadius: 8 }}
            onClick={() => setSelectedDay((prev) => (prev + 1) % 7)}
          >
            &#8594;
          </button>
        </div>
      </div>
      <button
        className="lp-btn"
        onClick={() => {
          startWork();
          navigate("/drive-stats");
        }}
      >
        Start Work
      </button>
    </div>
  );
}