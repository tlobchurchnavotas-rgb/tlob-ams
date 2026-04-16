import { isSupabaseConfigured, supabase } from "./supabaseClient.js";

function safeLocalAppend(entry) {
  try {
    const raw = localStorage.getItem("tlob_audit_logs");
    const arr = raw ? JSON.parse(raw) : [];
    const list = Array.isArray(arr) ? arr : [];
    list.unshift(entry);
    const trimmed = list.slice(0, 500);
    localStorage.setItem("tlob_audit_logs", JSON.stringify(trimmed));
  } catch {
    // Ignore local storage failures.
  }
}

export async function recordAuditLog({ actor, action, target, source = "app", metadata = {} }) {
  const actorId = actor?.id || null;
  const actorName = actor?.name || "System";
  const actorRole = actor?.role || "";

  const entry = {
    created_at: new Date().toISOString(),
    actor_id: actorId,
    actor_name: actorName,
    actor_role: actorRole,
    action,
    target: target || "",
    source,
    metadata,
  };

  if (!action) return;

  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from("audit_logs").insert({
        actor_id: actorId,
        actor_name: actorName,
        actor_role: actorRole,
        action,
        target: target || "",
        source,
        metadata,
      });
      if (error) throw error;
    } catch {
      safeLocalAppend(entry);
    }
  } else {
    safeLocalAppend(entry);
  }
}

