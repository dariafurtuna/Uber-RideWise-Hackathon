// utils/location.js
export async function sendCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Geolocation is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;

        // Send to your backend
        const response = await fetch("http://localhost:8000/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ latitude, longitude }),
        });

        if (!response.ok) {
          reject("Failed to send location");
        } else {
          resolve(await response.json());
        }
      },
      (err) => reject(err.message),
      { enableHighAccuracy: true }
    );
  });
}
