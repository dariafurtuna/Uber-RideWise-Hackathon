// live totals (in-memory demo)
export async function getTodayLive(driverId) {
  const r = await fetch(`${API}/flow/drivers/${encodeURIComponent(driverId)}/today_live`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export async function completeRide(driverId, { offer_id, net_eur, duration_mins }) {
  const r = await fetch(`${API}/flow/drivers/${encodeURIComponent(driverId)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ offer_id, net_eur, duration_mins }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
// src/api.js 
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function getNudges(earnerId) {
  return get(`/nudges/${encodeURIComponent(earnerId)}`);
}

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  // === Earnings ===
  topEarners: (limit = 10) => get(`/earners/top?limit=${limit}`),

  earnerDaily: (earnerId, limit = 14) =>
    get(`/earners/${encodeURIComponent(earnerId)}/daily?limit=${limit}`),

  incentives: (earnerId) =>
    get(`/incentives/${encodeURIComponent(earnerId)}`),

  earnerToday: (earnerId) =>
    get(`/earners/${encodeURIComponent(earnerId)}/today`),

  earnerTodayTime: (earnerId) =>
    get(`/earners/${encodeURIComponent(earnerId)}/today_time`),

  // === Wellness & Nudges ===
  getNudges: () => get(`/nudges`),

  // === Ride Management ===
  rateRide: (payload, debug = false) =>
    post(`/rides/rate?debug=${debug}`, payload),

  // === Heatmap Prediction ===
  heatmapPredict: async ({
    lat,
    lng,
    radiusKm = 3,
    whenISO,
    weight = "count",
  }) => {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius_km: String(radiusKm),
      weight,
      when: whenISO,
    });
    return get(`/heatmap/predict?${params.toString()}`);
  },
};


// dayOfWeek: 0=Sunday, 6=Saturday
export async function getForecast(cityId, dayOfWeek) {
  const dow = typeof dayOfWeek === 'number' ? dayOfWeek : (new Date().getDay());
  const res = await fetch(`http://127.0.0.1:8000/forecast/${cityId}/${dow}`);
  if (!res.ok) throw new Error("API error");
  return res.json();
};

// Named export for HeatmapView.jsx compatibility
export const fetchPredictedHeat = api.heatmapPredict;

export async function heatmapPredict({ lat, lng, whenISO, radiusKm = 3, weight = "count", mode = "grid" }) {
  const q = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    when: whenISO,
    radius_km: String(radiusKm),
    weight,
    mode,
  });
  const res = await fetch(`${API}/heatmap/predict?${q.toString()}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

