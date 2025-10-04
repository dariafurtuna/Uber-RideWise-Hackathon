// src/api.js
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
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
  topEarners: (limit = 10) => get(`/earners/top?limit=${limit}`),
  earnerDaily: (earnerId, limit = 14) =>
    get(`/earners/${encodeURIComponent(earnerId)}/daily?limit=${limit}`),
  incentives: (earnerId) =>
    get(`/incentives/${encodeURIComponent(earnerId)}`),

  // NEW: rate a ride (set debug=true to include anchors)
  rateRide: (payload, debug = false) =>
    post(`/rides/rate?debug=${debug}`, payload),
};
