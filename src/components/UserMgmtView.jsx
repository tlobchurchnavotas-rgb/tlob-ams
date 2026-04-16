import { useState } from "react";
import { Icon } from "./Icon.jsx";


// ─── USER MANAGEMENT VIEW ─────────────────────────────────────────────────────
function UserMgmtView({ appUsers, setAppUsers, theme, showNotif, currentUser }) {
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "Usher", active: true });

  const openAdd = () => { setEditUser(null); setForm({ name: "", username: "", password: "", role: "Usher", active: true }); setShowModal(true); };
  const openEdit = u => { setEditUser(u); setForm({ name: u.name, username: u.username, password: u.password, role: u.role, active: u.active }); setShowModal(true); };

  const handleSave = () => {
    if (!form.name || !form.username || !form.password) { showNotif("All fields required", "error"); return; }
    if (!editUser && appUsers.find(u => u.username === form.username)) { showNotif("Username already exists", "error"); return; }
    if (editUser) {
      setAppUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, ...form } : u));
      showNotif("User updated");
    } else {
      const ids = appUsers.map(u => parseInt(u.id.slice(1))).filter(n => !isNaN(n));
      const newId = `U${String(ids.length > 0 ? Math.max(...ids) + 1 : 1).padStart(3, "0")}`;
      setAppUsers(prev => [...prev, { id: newId, ...form }]);
      showNotif("User created");
    }
    setShowModal(false);
  };

  const toggleActive = id => {
    if (id === currentUser.id) { showNotif("Cannot disable your own account", "error"); return; }
    setAppUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));
    showNotif("User status updated");
  };

  const handleDelete = id => {
    if (id === currentUser.id) { showNotif("Cannot delete your own account", "error"); return; }
    setAppUsers(prev => prev.filter(u => u.id !== id)); showNotif("User removed", "warning");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: theme.textMuted }}>{appUsers.length} system users</div>
        <button className="btn" onClick={openAdd} style={{ background: theme.accent, color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="add" size={15} /> Add User
        </button>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, overflow: "hidden" }}>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {appUsers.map(u => (
              <tr key={u.id}>
                <td><code style={{ background: theme.surface2, padding: "2px 6px", borderRadius: 4, fontSize: 11, fontFamily: "DM Mono,monospace" }}>{u.id}</code></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: u.role === "Admin" ? "linear-gradient(135deg,#6366f1,#4f46e5)" : "linear-gradient(135deg,#06b6d4,#0891b2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>{u.name[0]}</div>
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{u.name}</span>
                    {u.id === currentUser.id && <span style={{ fontSize: 10, color: theme.accent, background: `${theme.accent}15`, padding: "1px 7px", borderRadius: 999 }}>You</span>}
                  </div>
                </td>
                <td><code style={{ fontSize: 13, fontFamily: "DM Mono,monospace", color: theme.textMuted }}>{u.username}</code></td>
                <td>
                  <span style={{ background: u.role === "Admin" ? `${theme.accent}18` : `${theme.accent2}18`, color: u.role === "Admin" ? theme.accent : theme.accent2, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>
                    {u.role}
                  </span>
                </td>
                <td><span className={`badge ${u.active !== false ? "tag-active" : "tag-inactive"}`}>{u.active !== false ? "Active" : "Disabled"}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => openEdit(u)} style={{ background: `${theme.accent}15`, color: theme.accent, padding: "5px 9px", borderRadius: 6, fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                      <Icon name="edit" size={12} /> Edit
                    </button>
                    <button className="btn" onClick={() => toggleActive(u.id)} style={{ background: u.active !== false ? `${theme.warning}15` : `${theme.success}15`, color: u.active !== false ? theme.warning : theme.success, padding: "5px 9px", borderRadius: 6, fontSize: 11 }}>
                      {u.active !== false ? "Disable" : "Enable"}
                    </button>
                    {u.id !== currentUser.id && (
                      <button className="btn" onClick={() => handleDelete(u.id)} style={{ background: `${theme.danger}15`, color: theme.danger, padding: "5px 9px", borderRadius: 6, fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                        <Icon name="trash" size={12} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editUser ? "Edit User" : "Add System User"}</h2>
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div><label>Full Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Pastor John" /></div>
              <div><label>Username *</label><input type="text" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="e.g. pastor.john" /></div>
              <div>
                <label>Password *</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••••" style={{ paddingRight: 40 }} />
                  <button className="btn" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "transparent", color: theme.textMuted, padding: 4 }}>
                    <Icon name={showPw ? "eyeOff" : "eye"} size={15} />
                  </button>
                </div>
              </div>
              <div>
                <label>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="Admin">Admin</option>
                  <option value="Usher">Usher</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", background: theme.surface2, borderRadius: 8 }}>
                <input type="checkbox" id="active-chk" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} style={{ width: "auto", accentColor: theme.accent }} />
                <label htmlFor="active-chk" style={{ margin: 0, cursor: "pointer", textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 400 }}>Account Active</label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: theme.surface2, color: theme.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Cancel</button>
              <button className="btn" onClick={handleSave} style={{ background: theme.accent, color: "white", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Save User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserMgmtView;
