import "/styles/Wellness.css";

export default function Wellness() {
  return (
    <div className="page wellness-page">
      <header className="wellness-header">
        <h1>Wellness & Safety</h1>
        <p>Smart reminders to keep you alert, safe, and performing your best.</p>
      </header>

      <section className="wellness-grid">
        <div className="card">
          <div className="icon">💧</div>
          <h2>Stay Hydrated</h2>
          <p>It’s been over an hour since your last break. Remember to drink water regularly to stay alert.</p>
          <button className="btn-blue-outline">Mark as Done</button>
        </div>

        <div className="card">
          <div className="icon">🧘‍♀️</div>
          <h2>Stretch Break</h2>
          <p>Quick 2-minute stretches can reduce fatigue and improve focus. Try neck rolls and shoulder shrugs.</p>
          <button className="btn-blue-outline">View Exercises</button>
        </div>

        <div className="card">
          <div className="icon">🕓</div>
          <h2>Rest Reminder</h2>
          <p>You’ve been online for 4.5 hours. Consider wrapping up in the next hour for optimal rest.</p>
          <button className="btn-blue-outline">Set End Time</button>
        </div>
      </section>

      <section className="wide-section">
        <div className="card wide">
          <div className="icon">🌦️</div>
          <h2>Weather Advisory</h2>
          <p>Light rain expected in 30 minutes. Drive carefully, increase following distance, and plan shorter trips if needed.</p>
          <div className="button-row">
            <button className="btn-blue-outline">View Forecast</button>
            <button className="btn-blue-outline">Safety Tips</button>
          </div>
        </div>
      </section>

      <section className="wide-section">
        <div className="card wide">
          <div className="icon">🕒</div>
          <h2>Optimized Schedule Suggestion</h2>
          <div className="schedule">
            <div className="schedule-item">
              <div>
                <strong>Now</strong>
                <p>Take a 15-minute break</p>
              </div>
              <span>4:30 PM</span>
            </div>
            <div className="schedule-item peak">
              <div>
                <strong>Peak</strong>
                <p>Drive evening rush (2–3 hours)</p>
              </div>
              <span>5:00 PM</span>
            </div>
            <div className="schedule-item">
              <div>
                <strong>End</strong>
                <p>Wrap up for the day</p>
              </div>
              <span>8:00 PM</span>
            </div>
          </div>
          <button className="btn-green full">Apply This Schedule</button>
        </div>
      </section>
    </div>
  );
}
