import { supabase } from "./supabaseClient.js";
import { recordAuditLog } from "./auditLogs.js";

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export function onAuthStateChange(callback) {
  if (!supabase) return { unsubscribe: () => {} };
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ?? null);
  });
  return data.subscription;
}

export async function signInWithPassword(email, password) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const session = data.session ?? null;
  if (session?.user) {
    try {
      await recordAuditLog({
        actor: { id: session.user.id, name: session.user.email || "User", role: "", email: session.user.email },
        action: "auth_login",
        target: session.user.id,
        source: "auth",
        metadata: { email: session.user.email || null },
      });
    } catch {}
  }
  return session;
}

export async function signOut() {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;
  await supabase.auth.signOut();
  if (user) {
    try {
      await recordAuditLog({
        actor: { id: user.id, name: user.email || "User", role: "", email: user.email },
        action: "auth_logout",
        target: user.id,
        source: "auth",
        metadata: { email: user.email || null },
      });
    } catch {}
  }
}

export async function resetPasswordForEmail(email) {
  if (!supabase) throw new Error("Supabase is not configured");
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function getOrCreateProfile(user) {
  if (!supabase) throw new Error("Supabase is not configured");
  const userId = user?.id;
  if (!userId) throw new Error("No user id");

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("id,name,role,username,avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const fallbackName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email ||
    "User";

  const fallbackUsername = (() => {
    const raw = (user.user_metadata?.username || user.email || "").split("@")[0] || "";
    return raw.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32) || "user";
  })();

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({ id: userId, name: fallbackName, username: fallbackUsername, avatar_url: null, role: "Usher" })
    .select("id,name,role,username,avatar_url")
    .single();

  if (insertError) throw insertError;
  return created;
}

