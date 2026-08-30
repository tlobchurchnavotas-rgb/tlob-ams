function supabaseUrl() {
  return String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
}

function anonKey() {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
}

export function isRegisterConfigured() {
  return Boolean(supabaseUrl() && anonKey());
}

async function callRegister(action, payload = {}) {
  if (!isRegisterConfigured()) {
    throw new Error("Self-registration is not configured.");
  }
  const res = await fetch(`${supabaseUrl()}/functions/v1/self-register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey()}`,
      apikey: anonKey(),
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  if (data.error) throw new Error(data.error);
  return data;
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
