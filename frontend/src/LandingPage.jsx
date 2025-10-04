import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import "/styles/LandingPage.css";
import { getForecast } from "./api";

const daysOfWeek = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
];

export default function LandingPage() {
  const [forecast, setForecast] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getForecast(1, selectedDay);
        setForecast(data.forecast || []);
      } catch (e) {
        console.error("Failed to fetch forecast", e);
      }
    }
    loadData();
  }, [selectedDay]);

  return (
    <div className="landingpage-root">
      <div className="landingpage-container">
        <div className="landingpage-header-row">
          <button
            aria-label="Previous day"
            className="landingpage-arrow-btn"
            style={{ marginRight: 16 }}
            onClick={() => setSelectedDay((prev) => (prev + 6) % 7)}
          >
            &#8592;
          </button>
          <h1 className="landingpage-title">
            {daysOfWeek[selectedDay]}'s Activity Forecast
          </h1>
          <button
            aria-label="Next day"
            className="landingpage-arrow-btn"
            style={{ marginLeft: 16 }}
            onClick={() => setSelectedDay((prev) => (prev + 1) % 7)}
          >
            &#8594;
          </button>
        </div>
        <div className="landingpage-chart-scroll">
          <div
            className="landingpage-chart"
            style={{ width: forecast.length * 36 }}
          >
            {(() => {
              const maxEph = Math.max(...forecast.map(f => f.eph || 0), 1);
              return forecast.map(f => (
                <div key={f.hour} className="landingpage-bar-col">
                  <div
                    className="landingpage-bar"
                    style={{ height: `${(f.eph / maxEph) * 180 || 2}px` }}
                  />
                  <small>{f.hour}:00</small>
                </div>
              ));
            })()}
          </div>
        </div>
        <button
          onClick={() => navigate("/drive-stats")}
          className="landingpage-btn"
        >
          Start Work
        </button>
      </div>
    </div>
  );
}