import { API_BASE_URL } from "./config";

const BASE = API_BASE_URL || (location.hostname === "localhost" ? "http://localhost:8080" : "");

async function req(path, options) {
  const url = BASE ? `${BASE}${path}` : path;
  const res = await fetch(url, options);
  const text = await res.text();
  let json = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json.error ? JSON.stringify(json.error) : JSON.stringify(json));
  return json;
}

export const Api = {
  searchPgs: ({ area, gender }) =>
    req(`/api/pgs?area=${encodeURIComponent(area)}&gender=${encodeURIComponent(gender)}`),

  pgDetails: (pgId) => req(`/api/pgs/${pgId}`),

  createBooking: (payload) =>
    req(`/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  myBookings: (userId, status) =>
    req(`/api/customer/bookings/${userId}${status ? `?status=${status}` : ""}`),

  cancelBooking: (bookingId, userId) =>
    req(`/api/customer/bookings/${bookingId}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    }),
};