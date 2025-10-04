import { useEffect, useState } from "react";
import { getForecast } from "./api";

export default function LandingPage() {
  const [forecast, setForecast] = useState([]);
  const [cityName, setCityName] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getForecast(3); // city_id=3
        setForecast(data.forecast || []);
        setCityName(data.city_name || `City ${data.city_name}`);
      } catch (e) {
        console.error("Failed to fetch forecast", e);
      }
    }
    loadData();
  }, []);

  return (
    <div>
      <h1>Today’s Activity Forecast</h1>
      <h2>{cityName}</h2>
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
    </div>
  );
}
