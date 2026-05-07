import { useState } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { recordAuditLog } from "../auditLogs.js";


// ─── VISITORS VIEW ────────────────────────────────────────────────────────────
function VisitorsView({ visitors, setVisitors, members, setMembers, events, theme, showNotif, currentUser }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", eventId: "", date: new Date().toISOString().split("T")[0], invitedBy: "", notes: "" });

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    const ids = visitors.map(v => parseInt(v.id.slice(1))).filter(n => !isNaN(n));
    const newId = `V${String(ids.length > 0 ? Math.max(...ids) + 1 : 1).padStart(3, "0")}`;
    const created = { id: newId, ...form, convertedToMember: false };
    setVisitors(prev => [...prev, created]);
    showNotif("Visitor logged!"); setShowModal(false);
    setForm({ name: "", contact: "", eventId: "", date: new Date().toISOString().split("T")[0], invitedBy: "", notes: "" });
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "visitor_logged",
        target: newId,
        source: "visitors",
        metadata: created,
      });
    } catch {}
  };

  const handleConvert = async v => {
    const ids = members.map(m => parseInt(m.id.slice(1))).filter(n => !isNaN(n));
    const newId = `M${String(ids.length > 0 ? Math.max(...ids) + 1 : 1).padStart(3, "0")}`;
    const member = {
      id: newId,
      name: v.name,
      contact: v.contact,
      ministry: "",
      status: "Active",
      joined: v.date,
      sourceEventId: v.eventId || "",
      photo: null,
      archived: false,
      birthday: "",
      anniversary: "",
    };
    setMembers(prev => [...prev, member]);
    setVisitors(prev => prev.map(x => x.id === v.id ? { ...x, convertedToMember: true } : x));
    showNotif(`${v.name} converted to member!`);
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "visitor_converted_to_member",
        target: newId,
        source: "visitors",
        metadata: { visitorId: v.id, memberId: newId, name: v.name },
      });
    } catch {}
  };

  const handleDelete = async id => {
    setVisitors(prev => prev.filter(v => v.id !== id));
    showNotif("Visitor removed", "warning");
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "visitor_deleted",
        target: id,
        source: "visitors",
        metadata: { visitorId: id },
      });
    } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: theme.textMuted }}>{visitors.length} total visitors logged</div>
        <button className="btn" onClick={() => setShowModal(true)} style={{ background: theme.accent, color: "white", padding: "9px 18px", borderRadius: 9, fontSize: 13, display: "flex", alignItems: "center", gap: 7 }}>
          <Icon name="add" size={15} /> Log Visitor
        </button>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, overflow: "hidden" }}>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Contact</th><th>Event</th><th>Date</th><th>Invited By</th><th>Notes</th><th>Actions</th></tr></thead>
          <tbody>
            {visitors.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 36, color: theme.textMuted }}>No visitors logged yet</td></tr>}
            {visitors.map(v => {
              const ev = events.find(e => e.id === v.eventId);
              const inviter = members.find(m => m.id === v.invitedBy);
              return (
                <tr key={v.id}>
                  <td><code style={{ background: theme.surface2, padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>{v.id}</code></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Avatar member={{ name: v.name }} size={26} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                        {v.convertedToMember && <span style={{ fontSize: 10, color: theme.success, fontWeight: 700 }}>✓ Now a Member</span>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: theme.textMuted, fontSize: 12 }}>{v.contact || "—"}</td>
                  <td style={{ fontSize: 12 }}>{ev?.name || "—"}</td>
                  <td style={{ color: theme.textMuted, fontSize: 12 }}>{v.date}</td>
                  <td style={{ fontSize: 12 }}>{inviter?.name || "—"}</td>
                  <td style={{ color: theme.textMuted, fontSize: 12, maxWidth: 140 }}>{v.notes || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 5 }}>
                      {!v.convertedToMember && (
                        <button className="btn" onClick={() => handleConvert(v)} style={{ background: `${theme.success}15`, color: theme.success, padding: "5px 9px", borderRadius: 6, fontSize: 11, border: `1px solid ${theme.success}25`, whiteSpace: "nowrap" }}>
                          → Member
                        </button>
                      )}
                      <button className="btn" onClick={() => handleDelete(v.id)} style={{ background: `${theme.danger}12`, color: theme.danger, padding: "5px 8px", borderRadius: 6, fontSize: 11 }}>
                        <Icon name="trash" size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 460 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Log New Visitor</h2>
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div><label>Full Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Visitor name" /></div>
              <div><label>Contact Number</label><input type="tel" value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="09XXXXXXXXX" /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label>Event</label>
                  <select value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))}>
                    <option value="">— Select —</option>
                    {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div><label>Date</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              </div>
              <div>
                <label>Invited By (Member)</label>
                <select value={form.invitedBy} onChange={e => setForm(f => ({ ...f, invitedBy: e.target.value }))}>
                  <option value="">— Select Member —</option>
                  {members.filter(m => !m.archived).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div><label>Notes</label><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Interests, remarks..." rows={2} style={{ resize: "vertical" }} /></div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 20, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: theme.surface2, color: theme.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Cancel</button>
              <button className="btn" onClick={handleAdd} style={{ background: theme.accent, color: "white", padding: "8px 20px", borderRadius: 8, fontSize: 13 }}>Log Visitor</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default VisitorsView;
