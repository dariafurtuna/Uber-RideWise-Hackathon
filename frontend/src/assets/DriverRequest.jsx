// src/DriverRequest.jsx
import { useEffect, useState } from "react";

import "/styles/App.css";

// Uber-themed styles for driver page
const uberDriverStyles = {
  page: {
    background: "#181818",
    minHeight: "100vh",
    color: "#fff",
    fontFamily: "Uber Move, Arial, sans-serif",
    padding: "32px 0",
  },
  section: {
    maxWidth: 900,
    margin: "0 auto",
    background: "#222",
    borderRadius: 16,
    boxShadow: "0 4px 24px rgba(0,0,0,0.2)",
    padding: 32,
  },
  card: {
    background: "#232323",
    border: "1px solid #333",
    borderRadius: 12,
    padding: 20,
    color: "#fff",
    marginBottom: 16,
  },
  button: {
    background: "#1c1c1c",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 24px",
    fontWeight: 600,
    fontSize: 16,
    marginRight: 8,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    transition: "background 0.2s",
  },
  buttonGreen: {
    background: "#2ecc40",
    color: "#fff",
  },
  buttonRed: {
    background: "#ff5a5f",
    color: "#fff",
  },
  buttonBlue: {
    background: "#007aff",
    color: "#fff",
  },
};

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DRIVER_ID = "d42"; // hardcoded for demo

export default function DriverRequest() {
  const [debug, setDebug] = useState(false);
  const [offer, setOffer] = useState(null);       // full offer (from /flow)
  const [secsLeft, setSecsLeft] = useState(0);    // countdown
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState(null);

  async function loadOffer() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/flow/drivers/${DRIVER_ID}/next?debug=${debug}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setOffer(data);
  setSecsLeft(30); // always 30 seconds for new offers
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function decide(decision) {
    if (!offer) return;
    setDeciding(true);
    setError(null);
    try {
      const r = await fetch(`${API}/flow/drivers/${offer.driver_id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offer.offer_id, decision }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setOffer((o) => (o ? { ...o, status: data.status } : o));
      // If declined, immediately load a new offer
      if (decision === "decline") {
        setTimeout(() => loadOffer(), 300); // slight delay for UX
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setDeciding(false);
    }
  }

  // initial load
  useEffect(() => { loadOffer(); /* on mount */ }, []); // eslint-disable-line

  // countdown tick
  useEffect(() => {
    if (!offer) return;
    if (secsLeft <= 0 || offer.status !== "pending") return;
    const id = setInterval(() => setSecsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [offer, secsLeft]);

  const rating = offer?.rating;
  const expired = !offer ? false : (secsLeft <= 0) || offer.status === "expired";
  const disabled = loading || deciding || expired || (offer?.status !== "pending");

  // Progress bar for Accept button
  const progress = offer && offer.status === "pending" ? Math.max(0, secsLeft) / 30 : 0;

  return (
    <div style={uberDriverStyles.page}>
      <section style={uberDriverStyles.section}>
        <h2 style={{ fontWeight: 700, fontSize: 32, marginBottom: 8 }}>Uber Driver – Incoming Ride</h2>
        <div className="sub" style={{ color: "#bbb", marginBottom: 24 }}>
          Server generates a simulated request via <code>GET /flow/drivers/:id/next</code>.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Left: offer + rating */}
          <div style={uberDriverStyles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: "#2ecc40" }}>
                  {rating ? Math.round(rating.overall) : "—"}
                </div>
                <div className="sub" style={{ color: "#bbb" }}>overall score</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600 }}>{rating?.label || "…"}</div>
                <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, background: "#333", fontSize: 12, color: "#fff" }}>
                  {rating?.decision || "…"}
                </div>
              </div>
            </div>

            <ul className="compact" style={{ marginTop: 10, color: "#fff" }}>
              <li>Profitability: {rating ? Math.round(rating.breakdown?.profitability ?? 0) : "…"}</li>
              <li>Time:          {rating ? Math.round(rating.breakdown?.time ?? 0) : "…"}</li>
              <li>Pickup:        {rating ? Math.round(rating.breakdown?.pickup ?? 0) : "…"}</li>
              <li>Traffic:       {rating ? Math.round(rating.breakdown?.traffic ?? 0) : "…"}</li>
              <li>Customer:      {rating ? Math.round(rating.breakdown?.customer ?? 0) : "…"}</li>
            </ul>

            <div className="sub" style={{ marginTop: 8, color: "#bbb" }}>
              <div>• {rating?.reasons?.profitability}</div>
              <div>• {rating?.reasons?.time}</div>
              <div>• {rating?.reasons?.pickup}</div>
              <div>• {rating?.reasons?.traffic}</div>
              <div>• {rating?.reasons?.customer}</div>
            </div>

            <div className="sub" style={{ marginTop: 10, color: "#bbb" }}>
              Offer: <b style={{ color: "#fff" }}>{offer?.offer_id || "…"}</b> • Status: <b style={{ color: "#fff" }}>{offer?.status || "…"}</b> •
              {" "}Expires in: <b style={{ color: "#2ecc40" }}>{Math.max(0, secsLeft)}s</b>
            </div>

            {error && <div className="error" style={{ marginTop: 8, color: "#ff5a5f" }}>⚠️ {String(error)}</div>}

            <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", color: "#bbb" }}>
                <input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} />
                <span>debug anchors</span>
              </label>
              <button
                style={{
                  ...uberDriverStyles.button,
                  ...uberDriverStyles.buttonGreen,
                  position: "relative",
                  overflow: "hidden",
                  width: 160,
                  height: 48,
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: 1,
                  boxShadow: "0 2px 8px rgba(44,204,64,0.15)",
                }}
                onClick={() => decide("accept")}
                disabled={disabled}
              >
                <span style={{ zIndex: 2, width: "100%", textAlign: "center" }}>
                  {deciding ? "…" : "Accept"}
                </span>
                {/* Sliding timer bar */}
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${progress * 100}%`,
                    background: "rgba(0,0,0,0.15)",
                    transition: "width 1s linear",
                    zIndex: 1,
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    right: 12,
                    top: 12,
                    fontSize: 14,
                    color: "#fff",
                    zIndex: 3,
                    opacity: 0.8,
                  }}
                >
                  {secsLeft}s
                </span>
              </button>
              <button style={{ ...uberDriverStyles.button, ...uberDriverStyles.buttonRed }} onClick={() => decide("decline")} disabled={disabled}>
                {deciding ? "…" : "Decline"}
              </button>
            </div>

            {debug && rating?.anchors_used && Object.keys(rating.anchors_used).length > 0 && (
              <pre className="debug" style={{ marginTop: 10, background: "#181818", color: "#2ecc40", padding: 8, borderRadius: 8 }}>{JSON.stringify(rating.anchors_used, null, 2)}</pre>
            )}
          </div>

          {/* Right: candidate preview */}
          <div style={uberDriverStyles.card}>
            <div className="sub" style={{ color: "#bbb" }}>Candidate (from server)</div>
            <pre className="debug" style={{ background: "#181818", color: "#fff", padding: 8, borderRadius: 8 }}>{JSON.stringify(offer?.candidate || {}, null, 2)}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}
