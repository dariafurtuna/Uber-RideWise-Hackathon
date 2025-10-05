import "/styles/Wellness.css";
import { useWaterHook } from "./hooks/waterHook";
import { useStretchHook } from "./hooks/stretchHook";
import StretchPopup from "./components/StretchPopup";
import { useEffect } from "react";

export default function Wellness() {
  const { visible: waterVisible, markAsDone: markWaterAsDone } = useWaterHook();
  const { visible: stretchVisible, markAsDone: markStretchAsDone } = useStretchHook();

  useEffect(() => {
    // Add class to ensure white background on wellness page
    document.documentElement.classList.add('wellness-active');
    document.body.classList.add('wellness-active');
    const root = document.getElementById('root');
    if (root) root.classList.add('wellness-active');
    
    return () => {
      // Clean up when leaving the page
      document.documentElement.classList.remove('wellness-active');
      document.body.classList.remove('wellness-active');
      const root = document.getElementById('root');
      if (root) root.classList.remove('wellness-active');
    };
  }, []);

  return (
    <div className="page wellness-page">
      <header className="wellness-header">
        <h1>Wellness & Safety</h1>
        <p>Smart reminders to keep you alert, safe, and performing your best.</p>
      </header>

      <section className="wellness-grid">
        <div className={`card ${waterVisible ? "visible" : "hidden"}`}>
          <div className="icon">💧</div>
          <h2>Stay Hydrated</h2>
          <p>
            It’s been over an hour since your last break. Remember to drink
            water regularly to stay alert.
          </p>
          <button className="btn-blue-outline" onClick={markWaterAsDone}>
            Mark as Done
          </button>
        </div>

        <StretchPopup visible={stretchVisible} markAsDone={markStretchAsDone} />

        <div className="card">
          <div className="icon">🕓</div>
          <h2>Rest Reminder</h2>
          <p>
            You’ve been online for 4.5 hours. Consider wrapping up in the next
            hour for optimal rest.
          </p>
          <button className="btn-blue-outline">Set End Time</button>
        </div>
      </section>

      <section className="wide-section">
        <div className="card wide">
          <div className="icon">🌦️</div>
          <div className="content">
            <h2>Weather Advisory</h2>
            <p>
              Light rain expected in 30 minutes. Drive carefully, increase
              following distance, and plan shorter trips if needed.
            </p>
            <div className="button-row">
              <button className="btn-blue-outline">View Forecast</button>
              <button className="btn-blue-outline">Safety Tips</button>
            </div>
          </div>
        </div>
      </section>

      <button className="continue-driving">Continue Driving</button>
    </div>
  );
}
