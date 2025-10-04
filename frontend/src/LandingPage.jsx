import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "inherit"
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: 900,
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
          <button
            aria-label="Previous day"
            style={{ fontSize: 28, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginRight: 16 }}
            onClick={() => setSelectedDay((prev) => (prev + 6) % 7)}
          >
            &#8592;
          </button>
          <h1 style={{ textAlign: "center", margin: 0, minWidth: 180 }}>
            {daysOfWeek[selectedDay]}'s Activity Forecast
          </h1>
          <button
            aria-label="Next day"
            style={{ fontSize: 28, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: 16 }}
            onClick={() => setSelectedDay((prev) => (prev + 1) % 7)}
          >
            &#8594;
          </button>
        </div>
        {/* Chart with fixed height, relative scaling, and horizontal scroll */}
        <div
          style={{
            width: "100%",
            maxWidth: 900,
            overflowX: "auto",
            margin: "0 auto",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 8,
            paddingBottom: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "4px",
              alignItems: "end",
              height: 200,
              minWidth: 1100,
              width: forecast.length * 36,
              transition: 'width 0.3s',
            }}
          >
            {(() => {
              const maxEph = Math.max(...forecast.map(f => f.eph || 0), 1);
              return forecast.map(f => (
                <div key={f.hour} style={{ flex: '0 0 32px', display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      height: `${(f.eph / maxEph) * 180 || 2}px`, // 180px max bar height, min 2px
                      width: 30,
                      background: "teal",
                      borderRadius: 4,
                      marginBottom: 4,
                      transition: 'height 0.3s',
                    }}
                  />
                  <small>{f.hour}:00</small>
                </div>
              ));
            })()}
          </div>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            marginTop: 48,
            padding: "12px 32px",
            fontSize: 18,
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
          }}
        >
          Start Work
        </button>
      </div>
    </div>
  );
}