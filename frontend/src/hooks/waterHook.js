import { useEffect, useState } from "react";

export function useWaterHook(intervalMs = 2 * 60 * 60 * 1000) {
  const [visible, setVisible] = useState(false);

  // Retrieve last dismissal time from localStorage
  const getLastDismissed = () => {
    const storedTime = localStorage.getItem("waterLastDismissed");
    return storedTime ? parseInt(storedTime, 10) : null;
  };

  const [lastDismissed, setLastDismissed] = useState(getLastDismissed);

  useEffect(() => {
    // Show the popup on first load if it hasn't been dismissed recently
    if (!lastDismissed || Date.now() - lastDismissed >= intervalMs) {
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
    localStorage.setItem("waterLastDismissed", currentTime.toString()); // Persist dismissal time
  };

  return { visible, markAsDone };
}
