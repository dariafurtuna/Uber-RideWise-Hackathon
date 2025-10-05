// src/HeatmapTimeline.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { heatmapPredict } from "./api";

// ---------- time helpers ----------
function toISOWithTZ(d) {
  const tzMin = -d.getTimezoneOffset();
  const sign = tzMin >= 0 ? "+" : "-";
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const hh = pad(tzMin / 60);
  const mm = pad(tzMin % 60);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .replace("Z", `${sign}${hh}:${mm}`);
}
const roundToHalfHour = (d) => {
  const x = new Date(d);
  const m = x.getMinutes();
  x.setMinutes(m < 30 ? 0 : 30, 0, 0);
  return x;
};
const addMinutes = (d, m) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() + m);
  return x;
};
const formatSlotLabel = (d) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// --- palette (Uber-ish) ---
function colorFor(v /* 0..1 */) {
  const colors = ["#7ED957", "#F7E463", "#F9B44C", "#F47C3C", "#E53935"];
  const i = Math.max(0, Math.min(4, Math.floor(v * 5)));
  return colors[i];
}

// === Inline SVG pin (no external image) ===
function makePinIcon(color = "#E53935") {
  const html = `
<svg width="30" height="46" viewBox="0 0 30 46" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,.45));">
  <path d="M15 46s12-14.1 12-25A12 12 0 0 0 15 9 12 12 0 0 0 3 21c0 10.9 12 25 12 25z" fill="${color}" stroke="#b21f1f" stroke-width="1.1"/>
  <circle cx="15" cy="21" r="5.5" fill="#fff"/>
</svg>`;
  return L.divIcon({
    className: "pin-icon-no-bg", // no white box
    html,
    iconSize: [30, 46],
    iconAnchor: [15, 46], // tip of pin
    popupAnchor: [0, -46],
  });
}

export default function HeatmapTimeline({
  defaultLat = 51.9244,
  defaultLng = 4.4777,
  defaultRadiusKm = 3,
  stepMinutes = 30,
  windowHours = 4,
  autoAdvanceMs = 2000, // 5s
  defaultWeight = "count",
}) {
  // -------- state --------
  const [lat, setLat] = useState(defaultLat);
  const [lng, setLng] = useState(defaultLng);
  const [radiusKm, setRadiusKm] = useState(defaultRadiusKm);
  const [weight, setWeight] = useState(defaultWeight);

  const [start, setStart] = useState(() => roundToHalfHour(new Date()));
  const steps = Math.max(1, Math.floor((windowHours * 60) / stepMinutes));
  const slots = useMemo(
    () => Array.from({ length: steps }, (_, i) => addMinutes(start, i * stepMinutes)),
    [start, stepMinutes, steps]
  );

  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [status, setStatus] = useState("");

  const cacheRef = useRef(new Map());
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const layerRef = useRef(null);

  // -------- map init --------
  useEffect(() => {
    const map = L.map("timeline-map", {
      center: [lat, lng],
      zoom: 13,
      preferCanvas: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // dedicated pane so pin stays above polygons
    map.createPane("pinPane");
    map.getPane("pinPane").style.zIndex = 700;

    // initial pin + radius
    markerRef.current = L.marker([lat, lng], {
      icon: makePinIcon(),
      pane: "pinPane",
      zIndexOffset: 1000,
    }).addTo(map);

    // click to move center/pin
    map.on("click", (e) => {
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
      markerRef.current.setLatLng(e.latlng);
      map.panTo(e.latlng);
    });

    // fix sizing after our fixed layout mounts
    setTimeout(() => map.invalidateSize(), 0);
    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    // optional geolocate
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const ll = [pos.coords.latitude, pos.coords.longitude];
          setLat(ll[0]);
          setLng(ll[1]);
          markerRef.current.setLatLng(ll);
          map.setView(ll, 13);
        },
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    return () => {
      window.removeEventListener("resize", onResize);
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------- sync pin & radius --------
  useEffect(() => {
    if (!mapRef.current) return;
    markerRef.current.setLatLng([lat, lng]).setZIndexOffset(1000);
  }, [lat, lng]);

  // -------- draw polygons (SOFT BORDERS) --------
  function renderGrid(payload) {
    if (layerRef.current) {
      mapRef.current.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (!payload?.cells?.length) {
      setStatus("No cells");
      return;
    }
    const polys = payload.cells.map((c) =>
      L.polygon(c.boundary, {
        stroke: false,          // soft/unclear borders
        fillOpacity: 0.45,      // lighter like your normal heatmap
        fillColor: colorFor(c.value),
      }).bindTooltip(`${(c.value * 100).toFixed(0)}%`, { sticky: true })
    );
    layerRef.current = L.layerGroup(polys).addTo(mapRef.current);
    // keep pin above
    markerRef.current.setZIndexOffset(1000);
    setStatus(`Cells: ${payload.cells.length} — ${new Date(payload.when_local).toLocaleString()}`);
  }

  // -------- fetch & cache --------
  async function loadSlot(d) {
    const tKey = d.toISOString().slice(0, 16);
    const locKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const key = `${tKey}|${locKey}|${radiusKm}|${weight}`;
    if (cacheRef.current.has(key)) return cacheRef.current.get(key);

    const whenISO = toISOWithTZ(d);
    const data = await heatmapPredict({ lat, lng, radiusKm, whenISO, weight, mode: "grid" });
    cacheRef.current.set(key, data);
    return data;
  }

  // -------- slideshow --------
  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus("Loading…");
        const d = slots[idx];
        const payload = await loadSlot(d);
        if (!cancelled) renderGrid(payload);
        // prefetch next
        const nextIdx = (idx + 1) % slots.length;
        void loadSlot(slots[nextIdx]).catch(() => {});
      } catch (e) {
        setStatus(`Error: ${e.message}`);
        console.error(e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, lat, lng, radiusKm, weight, slots]);

  // autoplay (5s)
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slots.length), autoAdvanceMs);
    return () => clearInterval(t);
  }, [playing, slots.length, autoAdvanceMs]);

  // IMPORTANT: do NOT reset index on lat/lng change
  useEffect(() => {
    cacheRef.current.clear();
    setIdx(0);
  }, [start, radiusKm, weight, stepMinutes, windowHours]);

  // -------- UI --------
  const currentLabel = formatSlotLabel(slots[idx] || start);
  const labelEvery = Math.max(1, Math.ceil(slots.length / 8));
  const axisLabels = slots.map((s, i) => (i % labelEvery === 0 ? formatSlotLabel(s) : ""));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        gridTemplateRows: "56px 64px 1fr",
        background: "#fff",
        zIndex: 1,
        overflow: "hidden",
      }}
    >
      {/* remove white box behind our SVG pin */}
      <style>{`.pin-icon-no-bg{background:none!important;border:0!important;}`}</style>

      {/* Top bar */}
      <div
        style={{
          height: 56,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 12px",
          background: "#0f1115",
          color: "white",
          zIndex: 3,
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
        }}
      >
        <strong style={{ marginRight: 8 }}>Heatmap Timeline</strong>

        <span>Lat</span>
        <input
          value={lat}
          onChange={(e) => setLat(parseFloat(e.target.value || lat))}
          style={{ width: 110, background: "#222", color: "#fff", border: "1px solid #444" }}
        />

        <span>Lng</span>
        <input
          value={lng}
          onChange={(e) => setLng(parseFloat(e.target.value || lng))}
          style={{ width: 110, background: "#222", color: "#fff", border: "1px solid #444" }}
        />

        <span>Radius (km)</span>
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={radiusKm}
          onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
          style={{ width: 160 }}
        />
        <span>{radiusKm.toFixed(1)}</span>

        <span>Weight</span>
        <select
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          style={{ background: "#222", color: "#fff", border: "1px solid #444" }}
        >
          <option value="count">Count</option>
          <option value="earnings">Earnings</option>
          <option value="surge">Surge</option>
        </select>

        <button
          onClick={() => setPlaying((p) => !p)}
          style={{
            marginLeft: 8,
            padding: "6px 10px",
            background: "#2b2f36",
            color: "#fff",
            border: "1px solid #3b404a",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>

        <span style={{ marginLeft: "auto", opacity: 0.9 }}>{status}</span>
      </div>

      {/* Timeline with axis */}
      <div
        style={{
          height: 64,
          display: "grid",
          gridTemplateColumns: "140px 1fr 260px",
          alignItems: "center",
          gap: 12,
          padding: "8px 12px 10px",
          background: "#ffffff",
          borderBottom: "1px solid #e6e7ea",
          zIndex: 2,
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontWeight: 600 }}>{currentLabel}</div>

        <div style={{ position: "relative" }}>
          {/* Axis labels */}
          <div
            style={{
              position: "absolute",
              top: -18,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: "#333",
              pointerEvents: "none",
            }}
          >
            {axisLabels.map((lbl, i) => (
              <span key={i} style={{ width: 0, transform: "translateX(-50%)" }}>
                {lbl}
              </span>
            ))}
          </div>

          {/* Ticks */}
          <div
            style={{
              position: "absolute",
              top: -4,
              left: 0,
              right: 0,
              height: 6,
              display: "flex",
              justifyContent: "space-between",
              pointerEvents: "none",
            }}
          >
            {slots.map((_, i) => (
              <span
                key={i}
                style={{
                  width: 1,
                  height: i % Math.max(1, Math.ceil(slots.length / 8)) === 0 ? 6 : 4,
                  background: "#b8bdc7",
                }}
              />
            ))}
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, steps - 1)}
            step={1}
            value={idx}
            onChange={(e) => setIdx(parseInt(e.target.value, 10))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, justifySelf: "end" }}>
          <span>Start</span>
          <input
            type="datetime-local"
            value={
              new Date(start.getTime() - start.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)
            }
            onChange={(e) => {
              const d = new Date(e.target.value);
              setStart(roundToHalfHour(d));
            }}
          />
          <span style={{ color: "#6b7280" }}>
            step {stepMinutes}m · window {windowHours}h
          </span>
        </div>
      </div>

      <div id="timeline-map" style={{ width: "100%", height: "100%", zIndex: 0 }} />
    </div>
  );
}
