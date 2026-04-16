import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { Icon } from "./Icon.jsx";
import { ROLES } from "../roles.js";
import { recordAuditLog } from "../auditLogs.js";

function roleBadgeStyle(role, theme) {
  if (role === ROLES.ADMIN) return { bg: `${theme.accent}18`, color: theme.accent };
  if (role === ROLES.PASTOR) return { bg: "rgba(168,85,247,.15)", color: "#a855f7" };
  return { bg: `${theme.accent2}18`, color: theme.accent2 };
}

export default function AccountManagementView({ theme, showNotif, currentUser, setCurrentUser }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode: 'create' } | { mode: 'edit', row }
  const [form, setForm] = useState({
    email: "",
    password: "",
    newPassword: "",
    confirmPassword: "",
    name: "",
    username: "",
    role: ROLES.USHER,
  });
  const [showPw, setShowPw] = useState(false);
  const [showEditPw, setShowEditPw] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,name,username,role,email,avatar_url")
        .order("name");
      if (error) throw error;
      setRows(data ?? []);
    } catch (e) {
      showNotif(e?.message || "Could not load accounts. Run supabase/schema_account_management.sql if this persists.", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [showNotif]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm({ email: "", password: "", newPassword: "", confirmPassword: "", name: "", username: "", role: ROLES.USHER });
    setShowPw(false);
    setModal({ mode: "create" });
  };

  const openEdit = (row) => {
    setForm({
      email: row.email || "",
      password: "",
      newPassword: "",
      confirmPassword: "",
      name: row.name || "",
      username: row.username || "",
      role: row.role || ROLES.USHER,
    });
    setShowEditPw(false);
    setModal({ mode: "edit", row });
  };

  const closeModal = () => setModal(null);

  const saveEdit = async () => {
    if (saving) return;
    if (!supabase || modal?.mode !== "edit") return;
    const row = modal.row;
    if (!form.name?.trim()) {
      showNotif("Name is required.", "error");
      return;
    }
    if (!form.username?.trim() || !/^[a-zA-Z0-9._-]{3,32}$/.test(form.username.trim())) {
      showNotif("Username must be 3–32 characters (letters, numbers, dot, underscore, dash).", "error");
      return;
    }
    if (![ROLES.ADMIN, ROLES.PASTOR, ROLES.USHER].includes(form.role)) {
      showNotif("Invalid role.", "error");
      return;
    }

    const np = form.newPassword?.trim() ?? "";
    const cp = form.confirmPassword?.trim() ?? "";
    const editingSelf = row.id === currentUser?.id;
    if (editingSelf && (np || cp)) {
      if (!np || !cp) {
        showNotif("Enter both new password and confirmation, or leave both empty.", "error");
        return;
      }
      if (np !== cp) {
        showNotif("New password and confirmation do not match.", "error");
        return;
      }
      if (np.length < 6) {
        showNotif("New password must be at least 6 characters.", "error");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        role: form.role,
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", row.id);
      if (error) throw error;

      if (editingSelf && np) {
        const { error: pwErr } = await supabase.auth.updateUser({ password: np });
        if (pwErr) throw pwErr;
      }

      showNotif(editingSelf && np ? "Account and password updated." : "Account updated");
      try {
        await recordAuditLog({
          actor: currentUser,
          action: "account_updated",
          target: row.id,
          source: "accounts",
          metadata: {
            userId: row.id,
            previousRole: row.role,
            newRole: payload.role,
            previousName: row.name,
            newName: payload.name,
          },
        });
      } catch {}
      if (row.id === currentUser?.id) {
        setCurrentUser((u) => (u ? { ...u, name: payload.name, username: payload.username, role: payload.role } : u));
      }
      closeModal();
      await load();
    } catch (e) {
      showNotif(e?.message || "Update failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const createAccount = async () => {
    if (saving) return;
    if (!supabase || modal?.mode !== "create") return;
    const email = form.email?.trim().toLowerCase();
    const password = form.password;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showNotif("Valid email is required.", "error");
      return;
    }
    if (!password || password.length < 6) {
      showNotif("Password must be at least 6 characters.", "error");
      return;
    }
    if (!form.name?.trim()) {
      showNotif("Display name is required.", "error");
      return;
    }
    if (![ROLES.ADMIN, ROLES.PASTOR, ROLES.USHER].includes(form.role)) {
      showNotif("Invalid role.", "error");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session: before },
      } = await supabase.auth.getSession();
      const rt = before?.refresh_token;
      const at = before?.access_token;
      if (!rt || !at) {
        showNotif("Session expired. Please sign in again.", "error");
        setSaving(false);
        return;
      }

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: form.name.trim(),
            role: form.role,
          },
        },
      });
      if (signUpErr) throw signUpErr;

      if (signUpData?.session) {
        const { error: sessErr } = await supabase.auth.setSession({
          refresh_token: rt,
          access_token: at,
        });
        if (sessErr) throw sessErr;
      }

      showNotif(signUpData?.user ? "Account created. They can sign in with this email and password." : "Invite sent (check email confirmation settings).");
      closeModal();
      await load();
    } catch (e) {
      const msg = e?.message || "Could not create account.";
      const status = e?.status;
      if (status === 429 || /429|too many requests/i.test(msg)) {
        showNotif("Supabase rate-limited signups (HTTP 429). Wait a bit and try again. If it keeps happening, increase Auth rate limits in Supabase Dashboard or create users from the Dashboard.", "error");
      } else {
        showNotif(msg, "error");
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 22, maxWidth: 560, width: "100%", margin: "0 auto" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Account management needs Supabase</div>
        <p style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.55 }}>
          Configure <code style={{ color: theme.text }}>REACT_APP_SUPABASE_URL</code> and <code style={{ color: theme.text }}>REACT_APP_SUPABASE_ANON_KEY</code>, then run{" "}
          <code style={{ color: theme.text }}>supabase/schema_account_management.sql</code> in the SQL Editor so Admin and Pastor can list and edit staff profiles.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.5, maxWidth: 560 }}>
            Create church system accounts (Supabase Auth) and assign roles: <b style={{ color: theme.text }}>Admin</b> and <b style={{ color: theme.text }}>Pastor</b> have full access;{" "}
            <b style={{ color: theme.text }}>Usher</b> can use the app but not this page.
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={openCreate}
          style={{
            background: theme.accent,
            color: "white",
            padding: "9px 16px",
            borderRadius: 10,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <Icon name="add" size={16} /> New account
        </button>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: "center", color: theme.textMuted, fontSize: 13 }}>Loading accounts…</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Username</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rb = roleBadgeStyle(r.role, theme);
                const isSelf = r.id === currentUser?.id;
                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {r.avatar_url ? (
                          <img src={r.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", border: `1px solid ${theme.border}` }} />
                        ) : (
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg,#6366f1,#06b6d4)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 12,
                              fontWeight: 800,
                              color: "white",
                            }}
                          >
                            {(r.name || "?")[0]}
                          </div>
                        )}
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{r.name || "—"}</span>
                        {isSelf && (
                          <span style={{ fontSize: 10, color: theme.accent, background: `${theme.accent}12`, padding: "2px 8px", borderRadius: 999 }}>You</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <code style={{ fontSize: 12, fontFamily: "DM Mono,monospace", color: theme.textMuted }}>{r.email || "—"}</code>
                    </td>
                    <td>
                      <code style={{ fontSize: 12, fontFamily: "DM Mono,monospace", color: theme.textMuted }}>{r.username || "—"}</code>
                    </td>
                    <td>
                      <span style={{ borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 700, ...rb }}>{r.role}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => openEdit(r)}
                        style={{
                          background: `${theme.accent}14`,
                          color: theme.accent,
                          padding: "6px 11px",
                          borderRadius: 8,
                          fontSize: 12,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Icon name="edit" size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && rows.length === 0 && (
          <div style={{ padding: 22, fontSize: 13, color: theme.textMuted, textAlign: "center" }}>No profiles found. Add an account or run the database migration for staff access.</div>
        )}
      </div>

      {modal?.mode === "create" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>New account</h2>
              <button type="button" className="btn" onClick={closeModal} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label>Email *</label>
                <input type="email" autoComplete="off" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@church.org" />
              </div>
              <div>
                <label>Password *</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    placeholder="At least 6 characters"
                    style={{ paddingRight: 42 }}
                  />
                  <button type="button" className="btn" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", color: theme.textMuted, padding: 4 }}>
                    <Icon name={showPw ? "eyeOff" : "eye"} size={15} />
                  </button>
                </div>
              </div>
              <div>
                <label>Display name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Jane Usher" />
              </div>
              <div>
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value={ROLES.ADMIN}>{ROLES.ADMIN}</option>
                  <option value={ROLES.PASTOR}>{ROLES.PASTOR}</option>
                  <option value={ROLES.USHER}>{ROLES.USHER}</option>
                </select>
              </div>
              <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.45 }}>
                If email confirmation is enabled in Supabase, the user must confirm before signing in. Password changes for existing users are done in Supabase Auth or via the password reset flow.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={closeModal} style={{ background: theme.surface2, color: theme.text, padding: "9px 16px", borderRadius: 9, fontSize: 13 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={saving}
                onClick={createAccount}
                style={{ background: theme.accent, color: "white", padding: "9px 18px", borderRadius: 9, fontSize: 13, opacity: saving ? 0.75 : 1 }}
              >
                {saving ? "Creating…" : "Create account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal?.mode === "edit" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 24, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700 }}>Edit account</h2>
              <button type="button" className="btn" onClick={closeModal} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}>
                <Icon name="close" size={18} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: theme.textMuted, padding: "8px 11px", borderRadius: 10, background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <b style={{ color: theme.text }}>Email:</b> {form.email || "—"}
              </div>
              <div>
                <label>Display name *</label>
                <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label>Username *</label>
                <input type="text" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="letters, numbers, dot, underscore, dash" />
              </div>
              <div>
                <label>Role</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value={ROLES.ADMIN}>{ROLES.ADMIN}</option>
                  <option value={ROLES.PASTOR}>{ROLES.PASTOR}</option>
                  <option value={ROLES.USHER}>{ROLES.USHER}</option>
                </select>
              </div>
              {modal.row.id === currentUser?.id ? (
                <>
                  <div style={{ marginTop: 4, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Change password</div>
                    <p style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.45, marginBottom: 10 }}>
                      Optional. Leave blank to keep your current password.
                    </p>
                  </div>
                  <div>
                    <label>New password</label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showEditPw ? "text" : "password"}
                        autoComplete="new-password"
                        value={form.newPassword}
                        onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                        placeholder="Leave blank to keep current"
                        style={{ paddingRight: 42 }}
                      />
                      <button type="button" className="btn" onClick={() => setShowEditPw(!showEditPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", color: theme.textMuted, padding: 4 }}>
                        <Icon name={showEditPw ? "eyeOff" : "eye"} size={15} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label>Confirm new password</label>
                    <input
                      type={showEditPw ? "text" : "password"}
                      autoComplete="new-password"
                      value={form.confirmPassword}
                      onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="Repeat new password"
                    />
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.45, marginTop: 4, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
                  To set or reset a password for <b style={{ color: theme.text }}>another</b> account, use Supabase Dashboard → <b style={{ color: theme.text }}>Authentication</b> → Users (the browser app cannot change other users passwords for security).
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={closeModal} style={{ background: theme.surface2, color: theme.text, padding: "9px 16px", borderRadius: 9, fontSize: 13 }}>
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                disabled={saving}
                onClick={saveEdit}
                style={{ background: theme.accent, color: "white", padding: "9px 18px", borderRadius: 9, fontSize: 13, opacity: saving ? 0.75 : 1 }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
