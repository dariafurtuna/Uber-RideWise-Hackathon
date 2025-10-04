import "/styles/Popup.css";
import { useState, useEffect } from "react";

export default function WaterPopup({ visible, markAsDone }) {
  const [isSliding, setIsSliding] = useState(false);
  const [showPopup, setShowPopup] = useState(visible);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowPopup(true);
    }, 7200000); // 2 hours in milliseconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const handleDismiss = () => {
    setIsSliding(true);
    setTimeout(() => {
      markAsDone();
      setIsSliding(false);
      setShowPopup(false);
    }, 2); // Slide animation duration
  };

  if (!showPopup && !isSliding) return null;

  return (
    <div className={`water-popup ${isSliding ? "slide-out" : ""}`}>
      <div className="popup-inner">
        <h3>💧 Hydration Reminder</h3>
        <p>
          You’ve been active for over two hours. Take a quick stretch, drink
          some water, and recharge before continuing.
        </p>
        <button className="btn-green" onClick={handleDismiss}>
          Mark as Done
        </button>
      </div>
    </div>
  );
}
