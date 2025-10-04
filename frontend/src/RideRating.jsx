import { useState } from "react";
import { api } from "./api";

function ErrorBanner({ error }) {
  if (!error) return null;
  return <div className="error">⚠️ {String(error)}</div>;
}

export default function RideRating() {
  const [rideDebug, setRideDebug] = useState(false);
  const [ride, setRide] = useState({ loading: false, error: null, result: null });
  const [rideForm, setRideForm] = useState({
    city_id: 1,
    request_time: new Date().toISOString(),
    driver_lat: 52.3702,
    driver_lon: 4.8952,
    pickup_lat: 52.3676,
    pickup_lon: 4.9041,
    drop_lat: 52.3770,
    drop_lon: 4.8970,
    est_distance_km: 7.5,
    est_duration_mins: 22,
    rider_id: "r123",
    rider_rating: 4.92,
  });

  function onRideChange(e) {
    const { name, value } = e.target;
    const numeric = new Set([
      "city_id","driver_lat","driver_lon","pickup_lat","pickup_lon",
      "drop_lat","drop_lon","est_distance_km","est_duration_mins","rider_rating",
    ]);
    setRideForm((f) => ({ ...f, [name]: numeric.has(name) ? Number(value) : value }));
  }

  async function rateNow() {
    try {
      setRide({ loading: true, error: null, result: null });
      const result = await api.rateRide(rideForm, rideDebug);
      setRide({ loading: false, error: null, result });
    } catch (e) {
      setRide({ loading: false, error: e, result: null });
    }
  }

  return (
    <section>
      <h2>Simulate Ride Request</h2>
      <div className="sub">
        Calls <code>POST /rides/rate</code> and shows the evaluation.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Left: form */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              "city_id","request_time","driver_lat","driver_lon",
              "pickup_lat","pickup_lon","drop_lat","drop_lon",
              "est_distance_km","est_duration_mins","rider_id","rider_rating"
            ].map((k) => (
              <label key={k} className="text-sm">
                <span style={{ display: "block", fontSize: 12, opacity: 0.7 }}>{k}</span>
                <input name={k} value={rideForm[k] ?? ""} onChange={onRideChange} className="input" />
              </label>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="checkbox" checked={rideDebug} onChange={(e) => setRideDebug(e.target.checked)} />
              <span>debug anchors</span>
            </label>
            <button onClick={rateNow} disabled={ride.loading} className="button">
              {ride.loading ? "Scoring…" : "Rate ride"}
            </button>
          </div>

          <ErrorBanner error={ride.error} />
        </div>

        {/* Right: result */}
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12, minHeight: 200 }}>
          {!ride.result ? (
            <div className="sub">Submit the form to see the evaluation.</div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <div style={{ fontSize: 28, fontWeight: 600 }}>{Math.round(ride.result.overall)}</div>
                  <div className="sub">overall score</div>
                </div>
              </div>

              <ul className="compact" style={{ marginTop: 10 }}>
                <li>Profitability: {Math.round(ride.result.breakdown?.profitability ?? 0)}</li>
                <li>Time: {Math.round(ride.result.breakdown?.time ?? 0)}</li>
                <li>Pickup: {Math.round(ride.result.breakdown?.pickup ?? 0)}</li>
                <li>Traffic: {Math.round(ride.result.breakdown?.traffic ?? 0)}</li>
                <li>Customer: {Math.round(ride.result.breakdown?.customer ?? 0)}</li>
              </ul>

              <div className="sub" style={{ marginTop: 8 }}>
                <div>• {ride.result.reasons?.profitability}</div>
                <div>• {ride.result.reasons?.time}</div>
                <div>• {ride.result.reasons?.pickup}</div>
                <div>• {ride.result.reasons?.traffic}</div>
                <div>• {ride.result.reasons?.customer}</div>
              </div>

              {rideDebug && ride.result.anchors_used && Object.keys(ride.result.anchors_used).length > 0 && (
                <pre className="debug" style={{ marginTop: 10 }}>
                  {JSON.stringify(ride.result.anchors_used, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
