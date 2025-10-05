import "/styles/Popup.css";
import { useState } from "react";

export default function StretchPopup({ visible, markAsDone }) {
  const [isSliding, setIsSliding] = useState(false);

  const handleDismiss = () => {
    setIsSliding(true);
    setTimeout(() => {
      markAsDone();
      setIsSliding(false);
    }, 2); // Slide animation duration
  };

  if (!visible && !isSliding) return null;

  return (
    <div className={`card ${visible ? "visible" : "hidden"}`}>
      <div className="icon">🧘‍♀️</div>
      <h2>Stretch Break</h2>
      <p>
        Quick 2-minute stretches can reduce fatigue and improve focus. Try
        neck rolls and shoulder shrugs.
      </p>
      <button className="btn-blue-outline" onClick={handleDismiss}>
        Mark as Done
      </button>
    </div>
  );
}