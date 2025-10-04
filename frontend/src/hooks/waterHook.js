import { useEffect, useState } from "react";

export function useWaterHook(intervalMs = 2 * 60 * 60 * 1000) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true); // show on first load
    const timer = setInterval(() => setVisible(true), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  const markAsDone = () => {
    setVisible(false); // Ensure visibility is set to false
    console.log("Hydration reminder dismissed"); // Debugging log
  };

  return { visible, markAsDone };
}
