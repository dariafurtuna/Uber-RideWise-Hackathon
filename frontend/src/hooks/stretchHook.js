import { useEffect, useState } from "react";

export function useStretchHook(intervalMs = 2 * 60 * 60 * 1000) {
  const [visible, setVisible] = useState(false);
  const [lastDismissed, setLastDismissed] = useState(null);

  useEffect(() => {
    // Retrieve last dismissal time from localStorage on mount
    const storedTime = localStorage.getItem("stretchLastDismissed");
    if (storedTime) {
      setLastDismissed(parseInt(storedTime, 10));
    }

    // Show the popup on first load if it hasn't been dismissed recently
    if (!storedTime || Date.now() - parseInt(storedTime, 10) >= intervalMs) {
      setVisible(true);
    }

    const timer = setInterval(() => {
      if (!lastDismissed || Date.now() - lastDismissed >= intervalMs) {
        setVisible(true);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs, lastDismissed]);

  const markAsDone = () => {
    setVisible(false);
    const currentTime = Date.now();
    setLastDismissed(currentTime);
    localStorage.setItem("stretchLastDismissed", currentTime.toString()); // Persist dismissal time
  };

  return { visible, markAsDone };
}