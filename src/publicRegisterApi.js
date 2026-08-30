import { isSupabaseConfigured } from "./supabaseClient.js";

function functionsUrl() {
  const base = window.env?.REACT_APP_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || "";
  return `${String(base).replace(/\/$/, "")}/functions/v1/self-register`;
}

function anonKey() {
  return window.env?.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || "";
}

async function callRegister(action, payload = {}) {
  if (!isSupabaseConfigured) {
    throw new Error("Self-registration is not configured.");
  }
  const key = anonKey();
  if (!key) throw new Error("Self-registration is not configured.");
  const res = await fetch(functionsUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  if (data.error) throw new Error(data.error);
  return data;
}

export function isPublicRegisterPath() {
  if (typeof window === "undefined") return false;
  const path = (window.location.pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/register" || path.endsWith("/register")) return true;
  // Hash fallback for local CRA (deep links may 404 without SPA rewrite)
  const hash = (window.location.hash || "").replace(/^#\/?/, "").split("?")[0];
  return hash === "register";
}

export async function fetchPublicEvents() {
  return callRegister("events");
}

export async function searchPublicMembers(q) {
  if (!String(q || "").trim() || String(q).trim().length < 3) return { members: [] };
  return callRegister("search", { q: String(q).trim() });
}

export async function submitPublicVisitor(fields) {
  return callRegister("submit", fields);
}
