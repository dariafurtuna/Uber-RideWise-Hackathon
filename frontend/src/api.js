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
  topEarners: (limit = 10) => get(`/earners/top?limit=${limit}`),
  earnerDaily: (earnerId, limit = 14) =>
    get(`/earners/${encodeURIComponent(earnerId)}/daily?limit=${limit}`),
  incentives: (earnerId) =>
    get(`/incentives/${encodeURIComponent(earnerId)}`),
  earnerToday: (earnerId) =>
    get(`/earners/${encodeURIComponent(earnerId)}/today`),
  earnerTodayTime: (earnerId) =>
    get(`/earners/${encodeURIComponent(earnerId)}/today_time`),
};


// dayOfWeek: 0=Sunday, 6=Saturday
export async function getForecast(cityId, dayOfWeek) {
  const dow = typeof dayOfWeek === 'number' ? dayOfWeek : (new Date().getDay());
  const res = await fetch(`http://127.0.0.1:8000/forecast/${cityId}/${dow}`);
  if (!res.ok) throw new Error("API error");
  return res.json();
}
;
