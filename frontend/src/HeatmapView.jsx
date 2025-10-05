import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchPredictedHeat } from "./api";

// helper: ISO string with timezone offset
function nowISO() {
  const d = new Date();
  const tzOffsetMin = -d.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const hh = pad(tzOffsetMin / 60);
  const mm = pad(tzOffsetMin % 60);
  return d.toISOString().replace("Z", `${sign}${hh}:${mm}`);
}

// simple ramp: green → yellow → red
function colorFor(v) {
  const r = Math.round(255 * v);
  const g = Math.round(255 * (1 - v));
  return `rgba(${r}, ${g}, 0, 0.6)`; // 60% opacity
}

export default function HeatmapView() {
  const [lat, setLat] = useState(51.9244);
  const [lng, setLng] = useState(4.4777);
  const [radiusKm, setRadiusKm] = useState(3);
  const [status, setStatus] = useState("");
  const [weight, setWeight] = useState("count");

  const whenISO = useMemo(() => nowISO(), []);

  const mapRef = useRef(null);
  const circleRef = useRef(null);
  const layerRef = useRef(null);

  // init map
  useEffect(() => {
    const map = L.map("heatmap-map", {
      center: [lat, lng],
      zoom: 13,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // click to move center
    map.on("click", (e) => {
      setLat(e.latlng.lat);
      setLng(e.latlng.lng);
    });

    return () => map.remove();
  }, []);

  // draw/update radius circle
  useEffect(() => {
    if (!mapRef.current) return;
    if (!circleRef.current) {
      circleRef.current = L.circle([lat, lng], {
        radius: radiusKm * 1000,
        color: "#4ea1ff",
        opacity: 0.5,
      }).addTo(mapRef.current);
    } else {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(radiusKm * 1000);
    }
  }, [lat, lng, radiusKm]);

  async function loadHeat() {
    try {
      
      const data = await fetchPredictedHeat({
        lat,
        lng,
        radiusKm,
        whenISO,
        weight,
        mode: "grid", // IMPORTANT
      });
      setStatus(`Loaded ${data.count} zones`);

      // remove old polygons if present
      if (layerRef.current) {
        mapRef.current.removeLayer(layerRef.current);
      }

      // draw polygons for each cell
      const polys = data.cells.map((c) =>
        L.polygon(c.boundary, {
          fillColor: colorFor(c.value),
          fillOpacity: 0.6,
          stroke: false,
        }).bindTooltip(
          `Value: ${(c.value * 100).toFixed(0)}%<br/>H3: ${c.h3}`,
          { sticky: true }
        )
      );

      layerRef.current = L.layerGroup(polys).addTo(mapRef.current);
      mapRef.current.panTo([lat, lng]);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      console.error(e);
    }
  }

  // reload when inputs change
  useEffect(() => {
    if (mapRef.current) loadHeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusKm, weight]);

  return (
    <div style={{ borderRadius: "50px", display: "grid", gridTemplateRows: "70px 1fr", height: "100%" }}>
      <div style={{ borderRadius: "17px", background: "#111", color: "#fff", display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
        <strong style={{ marginRight: 10 }}>Heat Zones</strong>

        <span>Lat</span>
        <input
          value={lat}
          onChange={(e) => setLat(parseFloat(e.target.value || lat))}
          style={{ width: 110 }}
        />
        <span>Lng</span>
        <input
          value={lng}
          onChange={(e) => setLng(parseFloat(e.target.value || lng))}
          style={{ width: 110 }}
        />

        <span style={{ marginLeft: 8 }}>Radius (km)</span>
        <input
          type="range"
          min="0.5"
          max="10"
          step="0.5"
          value={radiusKm}
          onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
          style={{ borderRadius: "17px", appearance: "none", width: 160, background: "#ffffffff", cursor: "pointer", accentColor: "#000" }}
        />
        <span>{radiusKm.toFixed(1)}</span>

        <span style={{ marginLeft: 10 }}>Weight</span>
        <select value={weight} onChange={(e) => setWeight(e.target.value)}>
          <option value="count">Count</option>
          <option value="earnings">Earnings</option>
          <option value="surge">Surge</option>
        </select>

        <span style={{ marginLeft: "auto", opacity: 0.85 }}>{status}</span>
      </div>

      <div id="heatmap-map" style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
