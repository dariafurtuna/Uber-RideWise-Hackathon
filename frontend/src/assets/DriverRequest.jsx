
/*
  DriverRequest.jsx — Minimal futurist Uber theme (v6)
  - Smooth crossfade to NEXT request after timeout AND after manual decline
  - Uses a single transitionToNext() helper with AbortController safety
  - Keeps: bigger grade chip, short reasons (no 'vs', no 'x… surge'),
           countdown above buttons, score circles, no suggestion/debug UI
*/

import { useEffect, useMemo, useRef, useState } from "react";
import "/styles/App.css";

/* ─────────────────────────────  design tokens  ───────────────────────────── */
const TOK = {
  text: "#111111",
  sub: "#6b7280",
  line: "rgba(17,17,17,0.08)",
  chipBg: "#f3f4f6",
  black: "#000000",
  danger: "#dc2626",
  ok: "#16a34a",
  neutral: "#6b7280",
  radius: 16,
};

/* ─────────────────────────────  inline icons  ─────────────────────────────── */
const Ico = {
  Trend: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M3 17l6-6 4 4 7-7" /><path d="M20 8V4h-4" />
    </svg>
  ),
  Clock: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" />
    </svg>
  ),
  Pin: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  Traffic: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M7 21v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" /><path d="M10 17l1-8h2l1 8M8 9l1-6h6l1 6" />
    </svg>
  ),
  Star: (p = {}) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
      <path d="M12 17.3L6.2 21l1.6-6.8L2 9.6l7-.6L12 2l3 7 7 .6-5.8 4.6L17.8 21z" />
    </svg>
  ),
};

/* ─────────────────────────────  helpers  ─────────────────────────────────── */
const Card = ({ children, fading }) => (
  <section style={{
    maxWidth: 960, margin: "32px auto", background:"#fff", color: TOK.text,
    borderRadius: TOK.radius, boxShadow:"0 8px 32px rgba(0,0,0,.06)", padding: 28,
    opacity: fading ? 0 : 1, transition: "opacity 260ms ease"
  }}>{children}</section>
);

const Hairline = ({mt=16, mb=16}) => (
  <div style={{ height: 1, background: TOK.line, marginTop: mt, marginBottom: mb }} />
);

// Shorten reasons: remove "vs …", trailing bracketed pieces "(…)" or "[…]",
// and remove "x… surge" tokens entirely.
function shortReason(text) {
  if (!text) return "";
  let t = text.replace(/\s*vs\s+.*$/i, "");               // drop comparisons
  t = t.replace(/\s*x\s*\d+(?:\.\d+)?\s*surge/ig, "");    // drop surge mention
  t = t.replace(/\s*[\(\[].*?[\)\]]\s*$/g, "");           // drop trailing ()
  return t.trim();
}

function gradeFromOverall(overall) {
  if (overall == null) return { label: "—", bg: "#f3f4f6", fg: TOK.text };
  if (overall >= 85) return { label: "Excellent", bg: "#171717", fg: "#ffffff" };
  if (overall >= 70) return { label: "Good",      bg: "#232323", fg: "#ffffff" };
  if (overall >= 55) return { label: "Fair",      bg: "#dcdcdc", fg: TOK.text   };
  return               { label: "Poor",      bg: "#efefef", fg: TOK.text   };
}

// Circle darkness based on score (0–100)
function circleStyles(val) {
  const v = Math.max(0, Math.min(100, val || 0));
  const light = 100 - v;
  const bg = `hsl(0, 0%, ${light}%)`;
  const fg = v > 60 ? "#fff" : TOK.text;
  return { bg, fg };
}

/* ─────────────────────────────  component  ───────────────────────────────── */
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
const DRIVER_ID = "d42";

export default function DriverRequest() {
  const [offer, setOffer] = useState(null);
  const [secsLeft, setSecsLeft] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState(null);
  const [fading, setFading] = useState(false);

  const abortRef = useRef(null); // cancel in-flight fetches
  const rating = offer?.rating;
  const candidate = offer?.candidate;

  async function fetchOffer() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const r = await fetch(`${API}/flow/drivers/${DRIVER_ID}/next?debug=false`, { signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  async function loadOffer() {
    setLoading(true); setError(null);
    try {
      const data = await fetchOffer();
      setOffer(data);
      setSecsLeft(data.ttl_seconds ?? 30);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  // Smooth transition helper: fade out → fetch next → swap → fade in
  async function transitionToNext() {
    setFading(true);
    try {
      const data = await fetchOffer();
      setOffer(data);                // swap while faded
      setSecsLeft(data.ttl_seconds ?? 30);
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message || String(e));
    } finally {
      requestAnimationFrame(() => setTimeout(() => setFading(false), 20));
    }
  }

  async function decide(decision) {
    if (!offer) return;
    setDeciding(true); setError(null);
    try {
      const r = await fetch(`${API}/flow/drivers/${offer.driver_id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offer.offer_id, decision }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setOffer(o => (o ? { ...o, status: data.status } : o));
      if (decision === "decline") {
        // tiny delay so user sees "declined" change, then crossfade
        setTimeout(() => transitionToNext(), 120);
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setDeciding(false);
    }
  }

  // initial
  useEffect(() => { loadOffer(); return () => abortRef.current?.abort(); }, []);

  // countdown
  useEffect(() => {
    if (!offer) return;
    if (secsLeft <= 0 || offer.status !== "pending") return;
    const id = setInterval(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [offer, secsLeft]);

  // timeout → smooth transition
  useEffect(() => {
    if (!offer) return;
    if (offer.status === "pending" && secsLeft === 0) {
      transitionToNext();
    }
  }, [offer, secsLeft]);

  const grade = gradeFromOverall(rating?.overall);

  const metrics = useMemo(() => ([
    { key:"profitability", label:"Profitability", icon:<Ico.Trend/>,  value: Math.round(rating?.breakdown?.profitability ?? 0), reason: shortReason(rating?.reasons?.profitability) },
    { key:"time",          label:"Time",          icon:<Ico.Clock/>,  value: Math.round(rating?.breakdown?.time ?? 0),          reason: shortReason(rating?.reasons?.time) },
    { key:"pickup",        label:"Pickup",        icon:<Ico.Pin/>,    value: Math.round(rating?.breakdown?.pickup ?? 0),        reason: shortReason(rating?.reasons?.pickup) },
    { key:"traffic",       label:"Traffic",       icon:<Ico.Traffic/>,value: Math.round(rating?.breakdown?.traffic ?? 0),       reason: shortReason(rating?.reasons?.traffic) },
    { key:"customer",      label:"Customer",      icon:<Ico.Star/>,   value: Math.round(rating?.breakdown?.customer ?? 0),      reason: shortReason(rating?.reasons?.customer) },
  ]), [rating]);

  const expired = offer ? secsLeft <= 0 || offer.status === "expired" : false;
  const disabled = loading || deciding || expired || (offer?.status !== "pending");

  const progress = offer && offer.status === "pending"
    ? Math.max(0, secsLeft) / (offer.ttl_seconds ?? 30)
    : 0;

  const Summary = ({label, value}) => (
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:20, fontWeight:700}}>{value}</div>
      <div style={{fontSize:13, color:TOK.sub}}>{label}</div>
    </div>
  );

  return (
    <div style={{background:"#f8f9fa", minHeight:"100vh"}}>
      <Card fading={fading}>
        {/* top: score + grade */}
        <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:72, fontWeight:800, lineHeight:1, letterSpacing:"-0.5px"}}>
              {rating ? Math.round(rating.overall) : "—"}
            </div>
            <div style={{fontSize:14, color:TOK.sub, marginTop:4}}>Overall score</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div
              style={{
                display:"inline-block",
                padding:"10px 16px",
                borderRadius:999,
                background: grade.bg,
                color: grade.fg,
                fontWeight:900,
                minWidth:132,
                textAlign:"center",
                fontSize:18,
              }}
            >
              {grade.label}
            </div>
          </div>
        </div>

        <Hairline mt={20} mb={20} />

        {/* summary row */}
        <div style={{display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:18}}>
          <Summary label="Distance" value={
            candidate?.est_distance_km != null ? `${candidate.est_distance_km} km` : "—"
          }/>
          <Summary label="Duration" value={
            candidate?.est_duration_mins != null ? `${candidate.est_duration_mins} min` : "—"
          }/>
          <Summary label="Estimate" value={
            (rating?.reasons?.profitability?.match(/€[\d.,]+/)?.[0]) ?? "—"
          }/>
          <Summary label="Rider" value={
            candidate?.rider_rating != null ? `${candidate.rider_rating.toFixed(2)}★` : "—"
          }/>
          <Summary label="Surge" value={
            (rating?.reasons?.profitability?.match(/x[\d.]+/)?.[0]) ?? "—"
          }/>
        </div>

        <Hairline />

        {/* metrics grid with score circles */}
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"18px 28px"}}>
          {metrics.map((m) => {
            const { bg, fg } = circleStyles(m.value);
            return (
              <div key={m.key}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
                  <div style={{display:"flex", alignItems:"center", gap:10}}>
                    <span>{m.icon}</span>
                    <span style={{fontWeight:600}}>{m.label}</span>
                  </div>
                  <div style={{
                    minWidth:40, height:40, borderRadius:"50%",
                    background:bg, color:fg, display:"flex",
                    alignItems:"center", justifyContent:"center",
                    fontWeight:800
                  }}>
                    {m.value || 0}
                  </div>
                </div>
                {m.reason && (
                  <div style={{marginLeft:28, marginTop:6, color:TOK.sub, fontSize:14}}>
                    {m.reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* status strip */}
        <div style={{
          background:TOK.chipBg, borderRadius:12, padding:"12px 14px",
          fontSize:14, color:"#374151", marginTop:24
        }}>
          <span>Offer: <b>{offer?.offer_id || "…"}</b></span>
          <span style={{margin:"0 8px"}}>•</span>
          <span>Status: <b style={{color:
            offer?.status==="accepted" ? TOK.ok :
            offer?.status==="declined" ? TOK.neutral :
            offer?.status==="expired" ? TOK.danger : TOK.text
          }}>{offer?.status || "…"}</b></span>
          <span style={{margin:"0 8px"}}>•</span>
          <span>Expires in: <b>{Math.max(0, secsLeft)}s</b></span>
        </div>

        {/* countdown bar ABOVE actions */}
        <div style={{ height:6, background:TOK.line, borderRadius:999, marginTop:14, overflow:"hidden" }}>
          <div style={{
            height:"100%", width:`${progress*100}%`, background:TOK.black,
            transition:"width 1s linear"
          }}/>
        </div>

        {/* actions */}
        <div style={{display:"flex", gap:16, marginTop:12}}>
          <button
            onClick={() => decide("accept")}
            disabled={disabled}
            style={{
              flex:1, padding:"16px 20px", background:TOK.black, color:"#fff",
              border:"none", borderRadius:12, fontWeight:800, fontSize:16,
              opacity: disabled ? .6 : 1, cursor: disabled ? "not-allowed" : "pointer"
            }}
          >
            {deciding && !loading ? "…" : "Accept"}
          </button>
          <button
            onClick={() => decide("decline")}
            disabled={disabled}
            style={{
              flex:1, padding:"16px 20px", background:"#fff", color:TOK.text,
              border:"1px solid #e5e7eb", borderRadius:12, fontWeight:800, fontSize:16,
              opacity: disabled ? .6 : 1, cursor: disabled ? "not-allowed" : "pointer"
            }}
          >
            {deciding && !loading ? "…" : "Decline"}
          </button>
        </div>

        {/* error */}
        {error && <div style={{marginTop:8, color:TOK.danger, fontWeight:600}}>⚠ {String(error)}</div>}
      </Card>
    </div>
  );
}
