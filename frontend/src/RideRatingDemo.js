// src/RideRatingDemo.jsx
import React, { useState } from "react";

export default function RideRatingDemo() {
  const [form, setForm] = useState({
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
  const [debug, setDebug] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const onChange = (e) => {
    const { name, value } = e.target;
    const numFields = new Set([
      "city_id","driver_lat","driver_lon","pickup_lat","pickup_lon",
      "drop_lat","drop_lon","est_distance_km","est_duration_mins","rider_rating",
    ]);
    setForm((f) => ({ ...f, [name]: numFields.has(name) ? Number(value) : value }));
  };

  const callApi = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`http://localhost:8000/rides/rate?debug=${debug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const Pill = ({ children }) => (
    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100">{children}</span>
  );

  const ScoreBar = ({ label, score }) => (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span><span>{Math.round(score || 0)}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, score || 0))}%` }} />
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Ride Rating Demo</h1>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4 p-4 rounded-2xl border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Simulate Incoming Request</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
              debug
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              "city_id","request_time","driver_lat","driver_lon","pickup_lat","pickup_lon",
              "drop_lat","drop_lon","est_distance_km","est_duration_mins","rider_id","rider_rating"
            ].map((k) => (
              <label key={k} className="text-sm">
                {k}
                <input name={k} value={form[k] ?? ""} onChange={onChange} className="w-full mt-1 p-2 border rounded" />
              </label>
            ))}
          </div>

          <button onClick={callApi} disabled={loading} className="mt-2 px-4 py-2 rounded-xl border text-sm">
            {loading ? "Scoring…" : "Rate ride"}
          </button>

          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </div>

        <div className="p-4 rounded-2xl border min-h-[200px]">
          <h2 className="text-lg font-medium mb-3">Driver Popup Preview</h2>
          {!result ? (
            <div className="text-sm text-gray-500">Submit the form to see the evaluation.</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-3xl font-semibold">{Math.round(result.overall)}</div>
                  <div className="text-sm text-gray-500">overall score</div>
                </div>
                <div className="text-right">
                  <div className="text-base font-medium">{result.label}</div>
                  <Pill>{result.decision}</Pill>
                </div>
              </div>

              <div className="space-y-3">
                <ScoreBar label="Profitability" score={result.breakdown?.profitability} />
                <ScoreBar label="Time"          score={result.breakdown?.time} />
                <ScoreBar label="Pickup"        score={result.breakdown?.pickup} />
                <ScoreBar label="Traffic"       score={result.breakdown?.traffic} />
                <ScoreBar label="Customer"      score={result.breakdown?.customer} />
              </div>

              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-xl bg-gray-50">
                  <div className="font-medium mb-1">Why this score?</div>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>Profitability: {result.reasons?.profitability}</li>
                    <li>Time: {result.reasons?.time}</li>
                    <li>Pickup: {result.reasons?.pickup}</li>
                    <li>Traffic: {result.reasons?.traffic}</li>
                    <li>Customer: {result.reasons?.customer}</li>
                  </ul>
                </div>
                {result.anchors_used && Object.keys(result.anchors_used).length > 0 && (
                  <div className="p-3 rounded-xl bg-gray-50">
                    <div className="font-medium mb-1">Debug anchors</div>
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(result.anchors_used, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Tip: toggle <code>debug</code> to include anchors from the backend. Backend must run on port 8000.
      </div>
    </div>
  );
}
