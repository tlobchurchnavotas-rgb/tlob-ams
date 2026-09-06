import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { Icon } from "./Icon.jsx";
import { recordAuditLog } from "../auditLogs.js";
import { usePersisted } from "../constants.js";
import { QRCode } from "../utils/qr.js";
import packageJson from "../../package.json";

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

export default function AdminSettingsView({ theme, showNotif, currentUser, setCurrentUser, completionPin, setCompletionPin, events = [] }) {
  const userId = currentUser?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", avatarUrl: "" });
  const [pinInput, setPinInput] = useState(completionPin || "");
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const fileInputRef = useRef(null);
  const [publicRegisterEnabled, setPublicRegisterEnabled] = usePersisted("public_register_enabled", true, userId);
  const [publicRegisterBaseUrl, setPublicRegisterBaseUrl] = usePersisted("public_register_base_url", "", userId);
  const [autoConvertAfterVisits, setAutoConvertAfterVisits] = usePersisted("auto_convert_after_visits", 2, userId);
  const [registerEventId, setRegisterEventId] = useState("");

  const canUseDb = useMemo(() => Boolean(isSupabaseConfigured && supabase && userId), [userId]);
  const openEvents = useMemo(
    () => (events || []).filter((e) => e.status === "Active" || e.status === "Upcoming"),
    [events],
  );
  const publicRegisterUrl = useMemo(() => {
    const origin = String(publicRegisterBaseUrl || "").trim().replace(/\/$/, "");
    if (!origin || origin.startsWith("file:")) return "";
    const qs = registerEventId ? `?event=${encodeURIComponent(registerEventId)}` : "";
    return `${origin}${qs}`;
  }, [publicRegisterBaseUrl, registerEventId]);

  useEffect(() => {
    setPinInput(completionPin || "");
  }, [completionPin]);

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
    if (!/^\d{6}$/.test(pinInput)) return "Completion PIN must contain exactly 6 digits.";
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
      if (result?.error) throw new Error(result.error);
      if (result?.updateAvailable) {
        setUpdateAvailable(true);
        setUpdateInfo(result.updateInfo);
        showNotif(`Update available! Version ${result.updateInfo?.version || "unknown"}. Click Download to get it.`, "success");
      } else {
        setUpdateAvailable(false);
        setUpdateInfo(null);
        showNotif(`You're already using the latest version (${result?.currentVersion || "current"}).`, "info");
      }
    } catch (error) {
      showNotif(`Error checking for updates: ${error?.message || "Unknown error"}`, "error");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const downloadUpdate = async () => {
    if (!window.tlob?.downloadUpdate) {
      showNotif("Download not available in this environment.", "error");
      return;
    }

    setDownloadingUpdate(true);
    try {
      await window.tlob.downloadUpdate();
      showNotif("Update downloaded! Restart the app to install.", "success");
    } catch (error) {
      showNotif(`Error downloading update: ${error?.message || "Unknown error"}`, "error");
    } finally {
      setDownloadingUpdate(false);
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
  }, [showNotif]);

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
      setCompletionPin(pinInput);
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
        <div className="responsive-form-grid" style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 18, alignItems: "start" }}>
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

            <div style={{ padding: "12px 14px", borderRadius: 12, background: theme.surface2, border: `1px solid ${theme.border}` }}>
              <label>Event Completion PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                disabled={loading || saving}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit PIN"
                aria-describedby="completion-pin-help"
              />
              <div id="completion-pin-help" style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
                Required before completing an event from the Events page or kiosk. Default PIN: 123456.
              </div>
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
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>Public self-registration</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4, marginBottom: 14 }}>
          Guests can log as visitors and check in from their phone. After enough unique event visits, kiosk can convert them to members automatically. You can still convert anyone manually from Visitors.
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={Boolean(publicRegisterEnabled)}
            onChange={(e) => setPublicRegisterEnabled(e.target.checked)}
          />
          <span style={{ fontSize: 13, fontWeight: 600, textTransform: "none", letterSpacing: 0, color: theme.text }}>Enable public registration link</span>
        </label>
        <div style={{ marginBottom: 14 }}>
          <label>Auto-convert after unique event visits</label>
          <input
            type="number"
            min={0}
            step={1}
            value={autoConvertAfterVisits ?? 2}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setAutoConvertAfterVisits("");
                return;
              }
              const n = Math.max(0, Math.floor(Number(raw) || 0));
              setAutoConvertAfterVisits(n);
            }}
            onBlur={() => {
              if (autoConvertAfterVisits === "" || autoConvertAfterVisits == null) setAutoConvertAfterVisits(2);
            }}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
            Default is 2 (first register + second event). Set to 0 to turn auto-convert off and convert only from Visitors.
          </div>
        </div>
        {publicRegisterEnabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label>Public register app URL (Vercel)</label>
              <input
                type="url"
                value={publicRegisterBaseUrl}
                onChange={(e) => setPublicRegisterBaseUrl(e.target.value)}
                placeholder="https://tlob-register.vercel.app"
              />
              <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
                Paste the URL of the separate visitor-register app (not the AMS desktop/site).
              </div>
            </div>
            <div>
              <label>Pin to event (optional QR)</label>
              <select value={registerEventId} onChange={(e) => setRegisterEventId(e.target.value)}>
                <option value="">Any open event (guest chooses)</option>
                {openEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}{ev.date ? ` (${ev.date})` : ""}</option>
                ))}
              </select>
            </div>
            {publicRegisterUrl ? (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label>Shareable link</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" readOnly value={publicRegisterUrl} />
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(publicRegisterUrl);
                          showNotif("Registration link copied");
                        } catch {
                          showNotif("Could not copy link", "error");
                        }
                      }}
                      style={{ background: theme.accent, color: "white", padding: "8px 12px", borderRadius: 10, fontSize: 12, whiteSpace: "nowrap" }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div style={{ padding: 8, background: "#fff", borderRadius: 10, border: `1px solid ${theme.border}` }}>
                  <QRCode value={publicRegisterUrl} size={112} />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: theme.textMuted }}>Enter your visitor-register Vercel URL above to generate a shareable link.</div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>Application</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
              Manage app updates and system information.
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: theme.surface2, border: `1px solid ${theme.border}`, fontSize: 12 }}>
              <span style={{ color: theme.textMuted }}>Current Version: </span>
              <span style={{ fontWeight: 600, color: theme.text }}>{packageJson.version}</span>
              {updateAvailable && (
                <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: `${theme.accent}20`, border: `1px solid ${theme.accent}`, fontSize: 11 }}>
                  <span style={{ color: theme.accent, fontWeight: 600 }}>Update available: {updateInfo?.version || "latest"}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              className="btn"
              disabled={checkingUpdates || downloadingUpdate}
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
                opacity: checkingUpdates || downloadingUpdate ? 0.6 : 1,
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
            {updateAvailable && (
              <button
                className="btn"
                disabled={downloadingUpdate}
                onClick={downloadUpdate}
                style={{
                  background: "#10b981",
                  color: "white",
                  padding: "9px 14px",
                  borderRadius: 10,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  opacity: downloadingUpdate ? 0.6 : 1,
                }}
              >
                {downloadingUpdate ? (
                  <>
                    <span style={{ width: 10, height: 10, borderRadius: 999, border: "2px solid rgba(255,255,255,.55)", borderTopColor: "white", display: "inline-block", animation: "spin 1s linear infinite" }} />
                    Downloading…
                  </>
                ) : (
                  <>
                    <Icon name="download" size={16} /> Download Update
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

