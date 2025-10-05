import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { fetchPredictedHeat } from "./api";

/* time helper */
function nowISO() {
  const d = new Date();
  const tzOffsetMin = -d.getTimezoneOffset();
  const sign = tzOffsetMin >= 0 ? "+" : "-";
  const pad = (n) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const hh = pad(tzOffsetMin / 60);
  const mm = pad(tzOffsetMin % 60);
  return d.toISOString().replace("Z", `${sign}${hh}:${mm}`);
}

/* soft green→yellow→red ramp with good readability */
function colorFor(v) {
  const r = Math.round(255 * v);
  const g = Math.round(210 * (1 - v) + 45);
  return `rgba(${r}, ${g}, 60, 0.56)`;
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

  /* init map */
  useEffect(() => {
    const map = L.map("heatmap-map", { center: [lat, lng], zoom: 12 });
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

  /* radius overlay */
  useEffect(() => {
    if (!mapRef.current) return;
    if (!circleRef.current) {
      circleRef.current = L.circle([lat, lng], {
        radius: radiusKm * 1000,
        color: "#111", weight: 1, opacity: 0.6,
      }).addTo(mapRef.current);
    } else {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(radiusKm * 1000);
    }
  }, [lat, lng, radiusKm]);

  async function loadHeat() {
    try {
      const data = await fetchPredictedHeat({
        lat, lng, radiusKm, whenISO, weight,
      });
      setStatus(`Loaded ${data.count} zones`);

      if (layerRef.current) mapRef.current.removeLayer(layerRef.current);

      const polys = (data.cells || []).map((c) =>
        L.polygon(c.boundary, {
          fillColor: colorFor(c.value),
          fillOpacity: 0.6,
          color: "transparent",
          weight: 0,
        }).bindTooltip(`<b>${(c.value * 100).toFixed(0)}%</b> · ${c.h3}`, { sticky: true })
      );

      layerRef.current = L.layerGroup(polys).addTo(mapRef.current);
      mapRef.current.panTo([lat, lng]);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      console.error(e);
    }
  }

  /* reload when inputs change */
  useEffect(() => {
    if (mapRef.current) loadHeat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, radiusKm, weight]);

  return (
    <div className="heat-root">
      <div className="chipbar">
        <div className="chip">
          <span className="chip-label">Lat</span>
          <input
            className="chip-input"
            value={lat}
            onChange={(e) => setLat(parseFloat(e.target.value || lat))}
            placeholder="latitude"
          />
        </div>

        <div className="chip">
          <span className="chip-label">Lng</span>
          <input
            className="chip-input"
            value={lng}
            onChange={(e) => setLng(parseFloat(e.target.value || lng))}
            placeholder="longitude"
          />
        </div>

        <div className="chip">
          <span className="chip-label">Radius</span>
          <input
            className="chip-range"
            type="range"
            min="0.5"
            max="10"
            step="0.5"
            value={radiusKm}
            onChange={(e) => setRadiusKm(parseFloat(e.target.value))}
          />
          <span className="chip-suffix">{radiusKm.toFixed(1)} km</span>
        </div>

        <div className="chip">
          <span className="chip-label">Weight</span>
          <select
            className="chip-select"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          >
            <option value="count">Count</option>
            <option value="earnings">Earnings</option>
            <option value="surge">Surge</option>
          </select>
        </div>

        <div className="chip status">{status}</div>
      </div>

      <div id="heatmap-map" className="heat-map" />
    </div>
  );
}
