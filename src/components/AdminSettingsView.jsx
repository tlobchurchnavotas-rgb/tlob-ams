import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { Icon } from "./Icon.jsx";
import { recordAuditLog } from "../auditLogs.js";

function deriveUsernameFromEmail(email) {
  const raw = (email || "").split("@")[0] || "";
  return raw.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32);
}

function loadLocalProfile(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`tlob_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalProfile(userId, profile) {
  if (!userId) return;
  try {
    localStorage.setItem(`tlob_profile_${userId}`, JSON.stringify(profile));
  } catch {}
}

export default function AdminSettingsView({ theme, showNotif, currentUser, setCurrentUser }) {
  const userId = currentUser?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", avatarUrl: "" });
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const fileInputRef = useRef(null);

  const canUseDb = useMemo(() => Boolean(isSupabaseConfigured && supabase && userId), [userId]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      setLoading(true);
      try {
        if (canUseDb) {
          const { data, error } = await supabase
            .from("profiles")
            .select("name,username,avatar_url")
            .eq("id", userId)
            .maybeSingle();
          if (error) throw error;
          const next = {
            name: data?.name ?? currentUser?.name ?? "",
            username: data?.username ?? currentUser?.username ?? deriveUsernameFromEmail(currentUser?.email),
            avatarUrl: data?.avatar_url ?? currentUser?.avatarUrl ?? "",
          };
          if (!cancelled) setForm(next);
        } else {
          const local = loadLocalProfile(userId);
          const next = {
            name: local?.name ?? currentUser?.name ?? "",
            username: local?.username ?? currentUser?.username ?? deriveUsernameFromEmail(currentUser?.email),
            avatarUrl: local?.avatarUrl ?? currentUser?.avatarUrl ?? "",
          };
          if (!cancelled) setForm(next);
        }
      } catch {
        if (!cancelled) {
          setForm({
            name: currentUser?.name ?? "",
            username: currentUser?.username ?? deriveUsernameFromEmail(currentUser?.email),
            avatarUrl: currentUser?.avatarUrl ?? "",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [canUseDb, currentUser?.email, currentUser?.name, currentUser?.avatarUrl, currentUser?.username, userId]);

  const pickFile = () => fileInputRef.current?.click?.();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      showNotif("Please select an image file.", "error");
      return;
    }
    const maxBytes = 300 * 1024;
    if (file.size > maxBytes) {
      showNotif("Image is too large. Please use an image under 300KB.", "error");
      return;
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("read failed"));
        reader.onload = () => resolve(String(reader.result || ""));
        reader.readAsDataURL(file);
      });
      setForm((f) => ({ ...f, avatarUrl: dataUrl }));
    } catch {
      showNotif("Could not read image file.", "error");
    }
  };

  const validate = () => {
    if (!form.name?.trim()) return "Name is required.";
    if (!form.username?.trim()) return "Username is required.";
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(form.username.trim())) {
      return "Username must be 3–32 characters (letters, numbers, dot, underscore, dash).";
    }
    if (form.avatarUrl && !/^https?:\/\//i.test(form.avatarUrl) && !form.avatarUrl.startsWith("data:image/")) {
      return "Profile picture must be a valid URL or uploaded image.";
    }
    return null;
  };

  const checkForUpdates = async () => {
    if (!window.tlob?.checkForUpdates) {
      showNotif("Updates not available in this environment.", "info");
      return;
    }

    setCheckingUpdates(true);
    try {
      const result = await window.tlob.checkForUpdates();
      if (result?.updateAvailable) {
        showNotif(`Update available! Version ${result.updateInfo?.version || "unknown"}. The app will download and install it automatically.`, "success");
      } else {
        showNotif("You're already using the latest version.", "info");
      }
    } catch (error) {
      showNotif(`Error checking for updates: ${error?.message || "Unknown error"}`, "error");
    } finally {
      setCheckingUpdates(false);
    }
  };

  // Setup update event listeners
  useEffect(() => {
    const handleUpdateAvailable = (info) => {
      showNotif(`Update available: ${info.version}. Downloading now...`, "info");
    };

    const handleUpdateDownloaded = (info) => {
      showNotif(`Update ready to install. Restart the app to apply it.`, "success");
    };

    const handleUpdateError = (error) => {
      showNotif(`Update error: ${error}`, "error");
    };

    if (window.tlob?.onUpdateAvailable) {
      window.tlob.onUpdateAvailable(handleUpdateAvailable);
      window.tlob.onUpdateDownloaded(handleUpdateDownloaded);
      window.tlob.onUpdateError(handleUpdateError);
    }

    return () => {
      // Cleanup listeners if needed
    };
  }, []);

  const save = async () => {
    const err = validate();
    if (err) {
      showNotif(err, "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        avatar_url: form.avatarUrl?.trim() || null,
      };

      if (canUseDb) {
        const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
        if (error) throw error;
      } else {
        saveLocalProfile(userId, { name: payload.name, username: payload.username, avatarUrl: payload.avatar_url || "" });
      }

      setCurrentUser((u) => ({
        ...u,
        name: payload.name,
        username: payload.username,
        avatarUrl: payload.avatar_url || "",
      }));
      showNotif("Settings saved");
      try {
        await recordAuditLog({
          actor: currentUser,
          action: "profile_updated",
          target: userId,
          source: "admin_settings",
          metadata: {
            name: payload.name,
            username: payload.username,
            avatarUpdated: Boolean(payload.avatar_url),
          },
        });
      } catch {}
    } catch (e) {
      showNotif(e?.message || "Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const avatarPreview = form.avatarUrl?.trim() || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>Admin Settings</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
              Update your profile details (this affects what appears in the header).
            </div>
          </div>
          <button
            className="btn"
            disabled={loading || saving}
            onClick={save}
            style={{
              background: theme.accent,
              color: "white",
              padding: "9px 14px",
              borderRadius: 10,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 7,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {saving ? (
              <>
                <span style={{ width: 10, height: 10, borderRadius: 999, border: "2px solid rgba(255,255,255,.55)", borderTopColor: "white", display: "inline-block", animation: "spin 1s linear infinite" }} />
                Saving…
              </>
            ) : (
              <>
                <Icon name="check" size={16} /> Save
              </>
            )}
          </button>
        </div>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ width: 120, height: 120, borderRadius: 18, overflow: "hidden", border: `1px solid ${theme.border}`, background: theme.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#6366f1,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 24 }}>
                  {(form.name?.trim()?.[0] || currentUser?.name?.[0] || "A").toUpperCase()}
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
            <button className="btn" onClick={pickFile} disabled={loading || saving} style={{ background: theme.surface2, color: theme.text, padding: "8px 10px", borderRadius: 10, fontSize: 12, display: "flex", alignItems: "center", gap: 7, border: `1px solid ${theme.border}` }}>
              <Icon name="upload" size={16} /> Upload picture
            </button>
            <button
              className="btn"
              onClick={() => setForm((f) => ({ ...f, avatarUrl: "" }))}
              disabled={loading || saving || !form.avatarUrl}
              style={{
                background: `${theme.danger}12`,
                color: theme.danger,
                padding: "8px 10px",
                borderRadius: 10,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: `1px solid ${theme.border}`,
                opacity: !form.avatarUrl ? 0.55 : 1,
              }}
            >
              <Icon name="trash" size={16} /> Remove
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label>Display Name</label>
              <input
                type="text"
                value={form.name}
                disabled={loading || saving}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Admin John"
              />
            </div>

            <div>
              <label>Username</label>
              <input
                type="text"
                value={form.username}
                disabled={loading || saving}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. admin.john"
              />
              <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
                Allowed: letters, numbers, dot, underscore, dash (3–32 chars).
              </div>
            </div>

            <div>
              <label>Profile picture URL (optional)</label>
              <input
                type="text"
                value={form.avatarUrl}
                disabled={loading || saving}
                onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
                placeholder="https://… (or use Upload above)"
              />
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: 12, background: theme.surface2, border: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted }}>
              <div><b style={{ color: theme.text }}>Account:</b> {currentUser?.email || "—"}</div>
              <div><b style={{ color: theme.text }}>Role:</b> {currentUser?.role || "—"}</div>
              {!canUseDb && <div><b style={{ color: theme.text }}>Storage:</b> Local (Supabase not configured)</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>Application</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
              Manage app updates and system information.
            </div>
          </div>
          <button
            className="btn"
            disabled={checkingUpdates}
            onClick={checkForUpdates}
            style={{
              background: theme.accent,
              color: "white",
              padding: "9px 14px",
              borderRadius: 10,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 7,
              opacity: checkingUpdates ? 0.6 : 1,
            }}
          >
            {checkingUpdates ? (
              <>
                <span style={{ width: 10, height: 10, borderRadius: 999, border: "2px solid rgba(255,255,255,.55)", borderTopColor: "white", display: "inline-block", animation: "spin 1s linear infinite" }} />
                Checking…
              </>
            ) : (
              <>
                <Icon name="refresh" size={16} /> Check for Updates
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

