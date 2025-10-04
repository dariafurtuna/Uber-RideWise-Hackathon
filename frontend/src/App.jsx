import "./app.css";
import RideRating from "./RideRating";

export default function App() {
  return (
    <div className="page">
      <header>
        <h1>Smart Earner – Ride Rating</h1>
        <div className="sub">API: {import.meta.env.VITE_API_URL || "http://localhost:8000"}</div>
      </header>

      <RideRating />
    </div>
  );
}
