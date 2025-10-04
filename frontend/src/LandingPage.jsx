import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getForecast } from "./api";

export default function LandingPage() {
  const [forecast, setForecast] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getForecast(1);
        setForecast(data.forecast || []);
      } catch (e) {
        console.error("Failed to fetch forecast", e);
      }
    }
    loadData();
  }, []);

  return (
    <div>
      <h1>Today’s Activity Forecast</h1>
      <div style={{ display: "flex", gap: "4px", alignItems: "end" }}>
        {forecast.map(f => (
          <div key={f.hour} style={{ flex: 1 }}>
            <div
              style={{
                height: `${f.eph * 5}px`,
                background: "teal",
              }}
            />
            <small>{f.hour}:00</small>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: '12px 32px',
            fontSize: 18,
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          Start Work
        </button>
      </div>
    </div>
  );
}
