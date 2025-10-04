import { useEffect, useState } from "react";
import { api } from "./api";
import "./app.css";

export function NudgePopup({ nudges, onClose }) {
  if (!nudges || nudges.length === 0) return null;
  return (
    <div className="nudge-popup">
      <div className="nudge-content">
        {nudges.map((nudge, index) => (
          <p key={index}>{nudge}</p>
        ))}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

export function Wellness({ selected }) {
  const [nudges, setNudges] = useState([]);

  useEffect(() => {
    if (!selected) return;
    api.getNudges(selected)
      .then((data) => setNudges(data.nudges || []))
      .catch((e) => console.error("Failed to fetch nudges:", e));
  }, [selected]);

  return <NudgePopup nudges={nudges} onClose={() => setNudges([])} />;
}