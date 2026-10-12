// src/lib/authEvents.js
// Axios interceptors run outside the React tree, so they can't call
// AuthContext's logout() directly. This tiny pub/sub lets AuthContext
// register its logout handler once on mount, and lets axios "notify" it
// when the session goes invalid (401) — this actually flips isLoggedIn to
// false (not just clearing AsyncStorage), which is what makes the navigator
// switch to the Login screen right away instead of the user being stuck on
// 401 errors until they manually restart the app.
let handler = null;
let fired = false; // several parallel requests can 401 together — only react once per session

export function resetSessionExpired() { fired = false; }

export function setSessionExpiredHandler(fn) {
  handler = fn;
}

export function notifySessionExpired() {
  if (fired) return;
  fired = true;
  if (handler) handler();
}
