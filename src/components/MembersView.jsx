import { useState, useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { getQRDataUrl } from "../utils/qr.js";
import { CHURCH_LOGO_SRC, AGE_GROUPS } from "../constants.js";
import { canManageChurchData } from "../roles.js";
import { recordAuditLog } from "../auditLogs.js";


function MembersView({ members, setMembers, theme, showNotif, currentUser, onViewProfile }) {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [form, setForm] = useState({ name: "", contact: "", ministry: "", ageGroup: "", status: "Active", joined: "", photo: null, birthday: "", anniversary: "" });
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showBulkPrintModal, setShowBulkPrintModal] = useState(false);

  const [filterMinistry, setFilterMinistry] = useState("All");
  const [filterAgeGroup, setFilterAgeGroup] = useState("All");
  const [filterJoinedFrom, setFilterJoinedFrom] = useState("");
  const [filterJoinedTo, setFilterJoinedTo] = useState("");

  const activeOrArchived = members.filter(m => (showArchived ? m.archived : !m.archived));
  const ministries = [...new Set(activeOrArchived.map(m => (m.ministry || "").trim()).filter(Boolean))].sort();
  const ageGroups = [...new Set(activeOrArchived.map(m => (m.ageGroup || "").trim()).filter(Boolean))].sort();

  const visible = activeOrArchived.filter(m => {
    const q = search.trim().toLowerCase();
    if (q) {
      const name = (m.name || "").toLowerCase();
      const id = (m.id || "").toLowerCase();
      const ministry = (m.ministry || "").toLowerCase();
      if (!name.includes(q) && !id.includes(q) && !ministry.includes(q)) return false;
    }

    if (filterMinistry !== "All" && (m.ministry || "") !== filterMinistry) return false;
    if (filterAgeGroup !== "All" && (m.ageGroup || "") !== filterAgeGroup) return false;

    // Dates are stored as yyyy-mm-dd strings (ISO) so lexicographic compare works.
    if (filterJoinedFrom) {
      if (!m.joined || m.joined < filterJoinedFrom) return false;
    }
    if (filterJoinedTo) {
      if (!m.joined || m.joined > filterJoinedTo) return false;
    }
    return true;
  });

  const buildFilterLabel = () => {
    const parts = [];
    if (showArchived) parts.push("Archived"); else parts.push("Active");
    if (filterMinistry !== "All") parts.push(`Ministry: ${filterMinistry}`);
    if (filterAgeGroup !== "All") parts.push(`Age Group: ${filterAgeGroup}`);
    if (filterJoinedFrom) parts.push(`Joined From: ${filterJoinedFrom}`);
    if (filterJoinedTo) parts.push(`Joined To: ${filterJoinedTo}`);
    if (search.trim()) parts.push(`Search: "${search.trim()}"`);
    return parts.join(" • ");
  };

  const downloadCsvForVisible = () => {
    if (!visible.length) { showNotif("No members to export", "warning"); return; }

    const header = ["ID", "Name", "Contact", "Ministry", "Age Group", "Status", "Joined"];
    const escapeCsv = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = visible.map(m => ([
      m.id,
      m.name,
      m.contact || "",
      m.ministry || "",
      m.ageGroup || "",
      m.archived ? "Archived" : (m.status || ""),
      m.joined || "",
    ].map(escapeCsv).join(",")));

    const filterLine = `# Filters: ${buildFilterLabel()}`;
    const csv = [filterLine, header.join(","), ...rows].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `members_export_${ts}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotif(`Exported ${visible.length} member${visible.length !== 1 ? "s" : ""} to CSV`);
  };

  const openPdfPrintForVisible = () => {
    if (!visible.length) { showNotif("No members to export", "warning"); return; }

    const win = window.open("", "_blank");
    const filterLabel = buildFilterLabel();
    const today = new Date().toISOString().slice(0, 10);

    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const bodyRows = visible.map(m => `
      <tr>
        <td><code>${esc(m.id)}</code></td>
        <td>${esc(m.name)}</td>
        <td>${esc(m.contact || "—")}</td>
        <td>${esc(m.ministry || "—")}</td>
        <td>${esc(m.ageGroup || "—")}</td>
        <td>${esc(m.archived ? "Archived" : (m.status || "—"))}</td>
        <td>${esc(m.joined || "—")}</td>
      </tr>
    `).join("");

    win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Members Export</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
    *{box-sizing:border-box;}
    body{font-family:Inter,system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#0f172a;}
    .hdr{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px;}
    .brand{display:flex;gap:10px;align-items:center;}
    .logo{width:38px;height:38px;border-radius:10px;border:1px solid #e2e8f0;object-fit:cover;background:#fff;}
    h1{font-size:16px;margin:0;font-weight:800;letter-spacing:-0.02em;}
    .meta{font-size:11px;color:#64748b;margin-top:2px;}
    .pill{display:inline-block;font-size:11px;padding:4px 10px;border-radius:999px;border:1px solid #e2e8f0;background:#f8fafc;color:#334155;}
    table{width:100%;border-collapse:collapse;margin-top:12px;}
    th,td{padding:10px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:left;vertical-align:top;}
    th{font-size:11px;color:#475569;text-transform:uppercase;letter-spacing:.06em;background:#f8fafc;}
    code{font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size:11px;background:#f1f5f9;padding:2px 6px;border-radius:6px;}
    .sub{margin-top:8px;font-size:12px;color:#334155;line-height:1.6;}
    .count{margin-top:8px;color:#64748b;font-size:11px;}
    @media print{
      body{margin:14px;}
      th{background:#f1f5f9 !important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    }
  </style>
</head>
<body>
  <div class="hdr">
    <div class="brand">
      <img class="logo" src="${CHURCH_LOGO_SRC}" alt="TLOB" />
      <div>
        <h1>Members Export</h1>
        <div class="meta">${esc(today)} · ${esc(visible.length)} member${visible.length !== 1 ? "s" : ""}</div>
      </div>
    </div>
    <span class="pill">Print / Save as PDF</span>
  </div>
  <div class="sub"><b>Filters:</b> ${esc(filterLabel || "None")}</div>
  <div class="count">Tip: In the print dialog, choose “Save as PDF”.</div>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>Name</th><th>Contact</th><th>Ministry</th><th>Age Group</th><th>Status</th><th>Joined</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
</body>
</html>`);
    win.document.close();
    setTimeout(() => win.print(), 350);
    showNotif(`Opened export for ${visible.length} member${visible.length !== 1 ? "s" : ""}`);
  };

  const openAdd = () => {
    const today = new Date().toISOString().split("T")[0];
    setEditMember(null);
    setForm({ name: "", contact: "", ministry: "", ageGroup: "", status: "Active", joined: today, photo: null, birthday: "", anniversary: "" });
    setShowModal(true);
  };
  const openEdit = m => {
    const fallbackJoined = new Date().toISOString().split("T")[0];
    setEditMember(m);
    setForm({ name: m.name, contact: m.contact, ministry: m.ministry || "", ageGroup: m.ageGroup || "", status: m.status, joined: m.joined || fallbackJoined, photo: m.photo || null, birthday: m.birthday || "", anniversary: m.anniversary || "" });
    setShowModal(true);
  };

  const handlePhotoUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setForm(f => ({ ...f, photo: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload = { ...form };
    if (editMember) {
      const before = editMember;
      const after = { ...before, ...payload };
      setMembers(prev => prev.map(m => m.id === before.id ? after : m));
      showNotif("Member updated");
      try {
        const fieldsToTrack = ["name", "contact", "ministry", "ageGroup", "status", "joined", "birthday", "anniversary"];
        const changedFields = fieldsToTrack
          .map((field) => {
            const beforeVal = before[field] ?? "";
            const afterVal = after[field] ?? "";
            if (String(beforeVal) === String(afterVal)) return null;
            return { field, before: beforeVal || null, after: afterVal || null };
          })
          .filter(Boolean);

        await recordAuditLog({
          actor: currentUser,
          action: "member_updated",
          target: before.id,
          source: "members",
          metadata: {
            memberId: before.id,
            beforeJoined: before.joined || null,
            afterJoined: after.joined || null,
            beforeStatus: before.status || null,
            afterStatus: after.status || null,
            changedFields,
          },
        });
      } catch {}
    } else {
      const ids = members.map(m => parseInt(m.id.slice(1))).filter(n => !isNaN(n));
      const nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1;
      const newId = `M${String(nextNum).padStart(3, "0")}`;
      const joined = payload.joined || new Date().toISOString().split("T")[0];
      const created = { id: newId, ...payload, joined, archived: false };
      setMembers(prev => [...prev, created]);
      showNotif("Member added");
      try {
        await recordAuditLog({
          actor: currentUser,
          action: "member_created",
          target: newId,
          source: "members",
          metadata: {
            memberId: newId,
            name: created.name,
            joined,
          },
        });
      } catch {}
    }
    setShowModal(false);
  };

  const handleArchive = async id => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, archived: true } : m));
    showNotif("Member archived", "warning");
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "member_archived",
        target: id,
        source: "members",
        metadata: { memberId: id },
      });
    } catch {}
  };

  const handleRestore = async id => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, archived: false } : m));
    showNotif("Member restored");
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "member_restored",
        target: id,
        source: "members",
        metadata: { memberId: id },
      });
    } catch {}
  };

  // CSV Import
  const handleCSVImport = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const lines = ev.target.result.split("\n").map(l => l.trim()).filter(Boolean);
      const header = lines[0].toLowerCase().split(",").map(h => h.trim());
      const nameIdx = header.findIndex(h => h.includes("name"));
      const contactIdx = header.findIndex(h => h.includes("contact") || h.includes("phone"));
      const ministryIdx = header.findIndex(h => h.includes("ministry") || h.includes("group"));
      const statusIdx = header.findIndex(h => h.includes("status"));
      const joinedIdx = header.findIndex(h => h.includes("joined") || h.includes("join date") || h.includes("join_date"));
      if (nameIdx < 0) { showNotif("CSV must have a 'name' column", "error"); return; }
      const ids = members.map(m => parseInt(m.id.slice(1))).filter(n => !isNaN(n));
      let nextNum = ids.length > 0 ? Math.max(...ids) + 1 : 1;
      const newMembers = lines.slice(1).map(line => {
        const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
        const id = `M${String(nextNum++).padStart(3, "0")}`;
        const today = new Date().toISOString().split("T")[0];
        const joined = joinedIdx >= 0 ? (cols[joinedIdx] || "").trim() : "";
        return { id, name: cols[nameIdx] || "Unknown", contact: contactIdx >= 0 ? cols[contactIdx] : "", ministry: ministryIdx >= 0 ? cols[ministryIdx] : "", status: statusIdx >= 0 ? cols[statusIdx] : "Active", joined: joined || today, photo: null, archived: false };
      }).filter(m => m.name && m.name !== "Unknown");
      setMembers(prev => [...prev, ...newMembers]);
      showNotif(`${newMembers.length} members imported!`);
      setShowCSVModal(false);
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}><Icon name="search" size={15} /></div>
          <input type="text" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <button className="btn" onClick={() => setShowArchived(!showArchived)} style={{ background: showArchived ? `${theme.warning}18` : theme.surface2, color: showArchived ? theme.warning : theme.textMuted, padding: "8px 14px", borderRadius: 8, fontSize: 13, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="archive" size={15} /> {showArchived ? "Active Members" : "Archived"}
        </button>
        {canManageChurchData(currentUser.role) && !showArchived && (
          <>
            <button className="btn" onClick={() => setShowCSVModal(true)} style={{ background: `${theme.accent2}18`, color: theme.accent2, padding: "8px 14px", borderRadius: 8, fontSize: 13, border: `1px solid ${theme.accent2}30`, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="upload" size={15} /> Import CSV
            </button>
            <button className="btn" onClick={() => setShowBulkPrintModal(true)} style={{ background: `rgba(16,185,129,.12)`, color: "#10b981", padding: "8px 14px", borderRadius: 8, fontSize: 13, border: `1px solid rgba(16,185,129,.2)`, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="print" size={15} /> Bulk Print QR
            </button>
            <button className="btn" onClick={openAdd} style={{ background: theme.accent, color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="add" size={15} /> Add Member
            </button>
          </>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ minWidth: 180 }}>
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Ministry</label>
          <select value={filterMinistry} onChange={e => setFilterMinistry(e.target.value)}>
            <option value="All">All Ministries</option>
            {ministries.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Age Group</label>
          <select value={filterAgeGroup} onChange={e => setFilterAgeGroup(e.target.value)}>
            <option value="All">All Age Groups</option>
            {/* Prefer currently used values, but fall back to constants list when empty */}
            {(ageGroups.length ? ageGroups : AGE_GROUPS).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Joined From</label>
          <input type="date" value={filterJoinedFrom} onChange={e => setFilterJoinedFrom(e.target.value)} />
        </div>
        <div style={{ minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>Joined To</label>
          <input type="date" value={filterJoinedTo} onChange={e => setFilterJoinedTo(e.target.value)} />
        </div>
        <button
          className="btn"
          onClick={downloadCsvForVisible}
          style={{ background: `${theme.accent2}18`, color: theme.accent2, padding: "8px 14px", borderRadius: 8, fontSize: 13, border: `1px solid ${theme.accent2}30`, display: "flex", alignItems: "center", gap: 6 }}
          title="Export current filtered list to CSV"
        >
          <Icon name="download" size={15} /> Export CSV
        </button>
        <button
          className="btn"
          onClick={openPdfPrintForVisible}
          style={{ background: `rgba(16,185,129,.12)`, color: "#10b981", padding: "8px 14px", borderRadius: 8, fontSize: 13, border: `1px solid rgba(16,185,129,.2)`, display: "flex", alignItems: "center", gap: 6 }}
          title="Print current filtered list (Save as PDF)"
        >
          <Icon name="print" size={15} /> Export PDF
        </button>
        <button
          className="btn"
          onClick={() => { setFilterMinistry("All"); setFilterAgeGroup("All"); setFilterJoinedFrom(""); setFilterJoinedTo(""); }}
          style={{ background: theme.surface2, color: theme.textMuted, padding: "8px 14px", borderRadius: 8, fontSize: 13, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 6 }}
          title="Clear filters"
        >
          <Icon name="close" size={15} /> Clear
        </button>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, overflow: "hidden" }}>
        <table>
          <thead><tr><th>ID</th><th>Name</th><th>Contact</th><th>Ministry</th><th>Age Group</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {visible.map(m => (
              <tr key={m.id}>
                <td><code style={{ background: theme.surface2, padding: "2px 6px", borderRadius: 4, fontSize: 11, fontFamily: "DM Mono,monospace" }}>{m.id}</code></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => onViewProfile(m)}>
                    <Avatar member={m} size={28} />
                    <span style={{ fontWeight: 500, color: theme.accent, textDecoration: "underline", textDecorationColor: "transparent", transition: "text-decoration-color .2s" }}
                      onMouseEnter={e => e.currentTarget.style.textDecorationColor = theme.accent}
                      onMouseLeave={e => e.currentTarget.style.textDecorationColor = "transparent"}>{m.name}</span>
                  </div>
                </td>
                <td style={{ color: theme.textMuted, fontSize: 13 }}>{m.contact || "—"}</td>
                <td style={{ color: theme.textMuted, fontSize: 13 }}>{m.ministry || "—"}</td>
                <td style={{ color: theme.textMuted, fontSize: 13 }}>{m.ageGroup || "—"}</td>
                <td><span className={`badge tag-${m.archived ? "archived" : m.status.toLowerCase()}`}>{m.archived ? "Archived" : m.status}</span></td>
                <td style={{ color: theme.textMuted, fontSize: 12 }}>{m.joined}</td>
                <td>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button className="btn" onClick={() => onViewProfile(m)} style={{ background: `${theme.accent2}15`, color: theme.accent2, padding: "5px 9px", borderRadius: 6, fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                      <Icon name="profile" size={12} /> Profile
                    </button>
                    {canManageChurchData(currentUser.role) && !m.archived && (
                      <>
                        <button className="btn" onClick={() => openEdit(m)} style={{ background: `${theme.accent}15`, color: theme.accent, padding: "5px 9px", borderRadius: 6, fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                          <Icon name="edit" size={12} />
                        </button>
                        <button className="btn" onClick={() => handleArchive(m.id)} style={{ background: `${theme.warning}15`, color: theme.warning, padding: "5px 9px", borderRadius: 6, fontSize: 11, display: "flex", alignItems: "center", gap: 3 }} title="Archive member">
                          <Icon name="archive" size={12} />
                        </button>
                      </>
                    )}
                    {canManageChurchData(currentUser.role) && m.archived && (
                      <button className="btn" onClick={() => handleRestore(m.id)} style={{ background: `${theme.success}15`, color: theme.success, padding: "5px 9px", borderRadius: 6, fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
                        <Icon name="restore" size={12} /> Restore
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <div style={{ padding: 36, textAlign: "center", color: theme.textMuted }}>No members found</div>}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editMember ? "Edit Member" : "Add New Member"}</h2>
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>
            {/* Photo Upload */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, padding: 14, background: theme.surface2, borderRadius: 10 }}>
              <Avatar member={form} size={56} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Profile Photo</div>
                <label style={{ cursor: "pointer", background: `${theme.accent}18`, color: theme.accent, padding: "6px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, textTransform: "none", letterSpacing: 0 }}>
                  <Icon name="camera" size={13} /> Upload Photo
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: "none" }} />
                </label>
                {form.photo && <button className="btn" onClick={() => setForm(f => ({ ...f, photo: null }))} style={{ marginLeft: 8, background: "transparent", color: theme.danger, fontSize: 11, padding: 0 }}>Remove</button>}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              {[["Full Name *", "name", "text"], ["Contact Number", "contact", "tel"]].map(([lbl, key, type]) => (
                <div key={key}>
                  <label>{lbl}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={lbl.replace(" *", "")} />
                </div>
              ))}
              <div>
                <label>Joined Date</label>
                <input type="date" value={form.joined || ""} onChange={e => setForm(f => ({ ...f, joined: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label>Birthday</label>
                  <input type="date" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
                </div>
                <div>
                  <label>Wedding Anniversary</label>
                  <input type="date" value={form.anniversary} onChange={e => setForm(f => ({ ...f, anniversary: e.target.value }))} />
                </div>
              </div>
              <div>
                <label>Age Group</label>
                <select value={form.ageGroup} onChange={e => setForm(f => ({ ...f, ageGroup: e.target.value }))}>
                  <option value="">Select Age Group</option>
                  {AGE_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label>Ministry / Group</label>
                <select value={form.ministry} onChange={e => setForm(f => ({ ...f, ministry: e.target.value }))}>
                  <option value="">Select Ministry</option>
                  {["Worship Team", "Youth Ministry", "Children's Church", "Prayer Team", "Media Team", "Ushers", "Deacons", "Women's Ministry"].map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  <option>Active</option><option>Inactive</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: theme.surface2, color: theme.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Cancel</button>
              <button className="btn" onClick={handleSave} style={{ background: theme.accent, color: "white", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVModal && (
        <div className="modal-overlay" onClick={() => setShowCSVModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 460 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Import Members from CSV</h2>
              <button className="btn" onClick={() => setShowCSVModal(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ padding: 16, background: `${theme.accent}0c`, border: `1px solid ${theme.accent}25`, borderRadius: 10, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.accent, marginBottom: 8 }}>CSV Format</div>
              <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.7 }}>
                Your CSV file must include these columns (in any order):<br />
                <code style={{ background: theme.surface2, padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>name, contact, ministry, status</code><br />
                Optional:<br />
                <code style={{ background: theme.surface2, padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>joined</code> (yyyy-mm-dd)
                The first row must be column headers.
              </div>
            </div>
            {/* Download sample */}
            <button className="btn" onClick={() => {
              const blob = new Blob(["name,contact,ministry,status,joined\nJohn Doe,09123456789,Worship Team,Active,2026-04-01\nJane Smith,09987654321,Youth Ministry,Active,2026-04-03"], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "sample_members.csv"; a.click();
            }} style={{ background: theme.surface2, color: theme.textMuted, padding: "8px 14px", borderRadius: 8, fontSize: 12, display: "flex", alignItems: "center", gap: 6, marginBottom: 16, border: `1px solid ${theme.border}` }}>
              <Icon name="download" size={14} /> Download Sample CSV
            </button>
            <label style={{ cursor: "pointer", background: theme.accent, color: "white", padding: "10px 18px", borderRadius: 9, fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 7, justifyContent: "center", textTransform: "none", letterSpacing: 0 }}>
              <Icon name="upload" size={16} /> Choose CSV File
              <input type="file" accept=".csv" onChange={handleCSVImport} style={{ display: "none" }} />
            </label>
          </div>
        </div>
      )}

      {showBulkPrintModal && (
        <BulkPrintModal members={members} theme={theme} showNotif={showNotif} onClose={() => setShowBulkPrintModal(false)} />
      )}
    </div>
  );
}

// ─── BULK PRINT MODAL ─────────────────────────────────────────────────────────
function BulkPrintModal({ members, theme, showNotif, onClose }) {
  const activeMembers = members.filter(m => !m.archived);
  const ministries = [...new Set(activeMembers.map(m => m.ministry).filter(Boolean))].sort();

  const [filterMinistry, setFilterMinistry] = useState("All");
  const [filterStatus, setFilterStatus] = useState("Active");
  const [filterJoinedFrom, setFilterJoinedFrom] = useState("");
  const [filterJoinedTo, setFilterJoinedTo] = useState("");
  const [searchFilter, setSearchFilter] = useState("");
  const [selected, setSelected] = useState(new Set());
  const isFirstLoad = useRef(true);

  const filtered = activeMembers.filter(m => {
    if (filterMinistry !== "All" && m.ministry !== filterMinistry) return false;
    if (filterStatus !== "All" && m.status !== filterStatus) return false;
    if (filterJoinedFrom && m.joined && m.joined < filterJoinedFrom) return false;
    if (filterJoinedTo && m.joined && m.joined > filterJoinedTo) return false;
    if (searchFilter && !m.name.toLowerCase().includes(searchFilter.toLowerCase()) && !m.id.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

  // Auto-select filtered results only on first load
  useEffect(() => {
    if (isFirstLoad.current) {
      setSelected(new Set(filtered.map(m => m.id)));
      isFirstLoad.current = false;
    }
  }, [filtered]);

  const toggleOne = id => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll = () => {
    const allFilteredSelected = filtered.every(m => selected.has(m.id));
    setSelected(prev => {
      const s = new Set(prev);
      filtered.forEach(m => allFilteredSelected ? s.delete(m.id) : s.add(m.id));
      return s;
    });
  };
  const allFilteredSelected = filtered.length > 0 && filtered.every(m => selected.has(m.id));
  const someFilteredSelected = filtered.some(m => selected.has(m.id));

  const selectedMembers = activeMembers.filter(m => selected.has(m.id));

  const doPrint = async () => {
    if (selectedMembers.length === 0) { showNotif("Walang napiling member!", "error"); return; }
    const win = window.open("", "_blank");
    
    const cards = await Promise.all(selectedMembers.map(async m => {
      const qrVal = `TLOB:${m.id}:${m.name}`;
      const dataUrl = await getQRDataUrl(qrVal, { width: 100, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } });
      return {
        name: m.name,
        id: m.id,
        ministry: m.ministry || "",
        status: m.status,
        joined: m.joined || "—",
        qrDataUrl: dataUrl
      };
    }));

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>QR Cards - TLOB</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: "Inter", system-ui, sans-serif;
      background: white;
    }
    
    @page {
      size: letter;
      margin: 0.3in;
    }
    
    .container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      padding: 0;
      margin: 0;
    }
    
    .card {
      width: 100%;
      aspect-ratio: 2.5 / 3.2;
      border: 5px solid #000000;
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      background: white;
      page-break-inside: avoid;
      gap: 8px;
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 6px 8px;
      border-radius: 5px;
    }
    
    .card-logo {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.3);
      object-fit: cover;
      flex-shrink: 0;
    }
    
    .card-title {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.2;
      flex: 1;
    }
    
    .qr-box {
      padding: 6px;
      border: 1.5px solid #144dbe;
      border-radius: 6px;
      background: #f9fafb;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .qr-box img {
      width: 210px;
      height: 220px;
      display: block;
    }
    
    .card-name {
      font-weight: 700;
      font-size: 15px;
      text-align: center;
      color: #000;
      max-width: 100%;
      line-height: 1.2;
      margin-top: 0px;
    }
    
    .card-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      width: 100%;
      flex: 1;
      justify-content: flex-end;
    }
    
    .card-status-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      width: 100%;
    }
    
    .card-tags {
      display: flex;
      gap: 1px;
      flex-wrap: wrap;
      justify-content: center;
      width: 800%;
      font-size: 1px;
    }
    
    .tag {
      padding: 0px 1px;
      border-radius: 3px;
      background: #f3f4f6;
      color: #374151;
      border: 0.5px solid #d1d5db;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 90%;
    }
    
    .tag-status {
      background: #e0f2fe;
      color: #0369a1;
      border-color: #06b6d4;
      font-weight: 600;
      font-size: 12px;
      padding: 1px 6px;
    }
    
    .card-footer {
      width: 100%;
      text-align: center;
      font-size: 10px;
      font-weight: 600;
      color: #666;
      border-top: 1px solid #5d5f64;
      padding-top: 6px;
      margin-top: 8px;
    }
    
    .dot {
      display: inline-block;
      width: 5px;
      height: 5px;
      border-radius: 50%;
      margin-right: 3px;
      vertical-align: middle;
    }
    
    .dot-active { background: #10b981; }
    .dot-inactive { background: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    ${cards.map(card => `
      <div class="card">
        <div class="card-header">
          <img class="card-logo" src="${CHURCH_LOGO_SRC}" alt="Logo">
          <div class="card-title">TLOB<br>Member ID</div>
        </div>
        
        <div class="qr-box">
          <img src="${card.qrDataUrl}" alt="QR">
        </div>
        
        <div class="card-name">${card.name}</div>
        
        <div class="card-info">
          <div class="card-status-row">
            <span class="tag">${card.id}</span>
            <div class="tag tag-status">
              <span class="dot ${card.status === "Active" ? "dot-active" : "dot-inactive"}"></span>
              ${card.status}
            </div>
          </div>
          <div class="card-footer">Gamitin ito para sa iyong Weekly Attendance.</div>
        </div>
      </div>
    `).join("")}
  </div>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
    showNotif(`Printing ${selectedMembers.length} QR card${selectedMembers.length > 1 ? "s" : ""}!`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 0, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: theme.text }}>🖨️ Bulk Print QR Cards</h2>
            <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>I-filter at piliin kung sino ang ipi-print</p>
          </div>
          <button className="btn" onClick={onClose} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
        </div>

        {/* Filters */}
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${theme.border}`, background: theme.surface2, flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label>Ministry</label>
              <select value={filterMinistry} onChange={e => setFilterMinistry(e.target.value)}>
                <option value="All">All Ministries</option>
                {ministries.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="All">All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label>Search</label>
              <input type="text" placeholder="Name or ID..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label>Joined From</label>
              <input type="date" value={filterJoinedFrom} onChange={e => setFilterJoinedFrom(e.target.value)} />
            </div>
            <div>
              <label>Joined To</label>
              <input type="date" value={filterJoinedTo} onChange={e => setFilterJoinedTo(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Member List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Select All Row */}
          <div style={{ padding: "10px 24px", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 10, background: theme.surface2 }}>
            <input type="checkbox" checked={allFilteredSelected} ref={el => { if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected; }}
              onChange={toggleAll} style={{ width: 15, height: 15, cursor: "pointer", accentColor: theme.accent }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: theme.textMuted }}>
              {allFilteredSelected ? "Deselect All" : "Select All"} na visible ({filtered.length})
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: theme.accent, background: theme.accentGlow, padding: "2px 10px", borderRadius: 999 }}>
              {selected.size} napili
            </span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: theme.textMuted, fontSize: 13 }}>Walang member na nag-match sa filters</div>
          ) : (
            <div>
              {filtered.map(m => (
                <div key={m.id} onClick={() => toggleOne(m.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 24px", borderBottom: `1px solid ${theme.border}`, cursor: "pointer", background: selected.has(m.id) ? theme.accentGlow : "transparent", transition: "background .15s" }}
                  onMouseEnter={e => { if (!selected.has(m.id)) e.currentTarget.style.background = theme.surface2; }}
                  onMouseLeave={e => { e.currentTarget.style.background = selected.has(m.id) ? theme.accentGlow : "transparent"; }}>
                  <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 15, height: 15, cursor: "pointer", accentColor: theme.accent, flexShrink: 0 }} />
                  <Avatar member={m} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted }}>{m.ministry || "No Ministry"}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <code style={{ fontSize: 10, background: theme.surface2, padding: "2px 6px", borderRadius: 4, color: theme.textMuted, fontFamily: "DM Mono,monospace" }}>{m.id}</code>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>Joined {m.joined || "—"}</div>
                  </div>
                  <span className={`badge tag-${m.status.toLowerCase()}`} style={{ flexShrink: 0, fontSize: 9 }}>{m.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${theme.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.surface, flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: theme.textMuted }}>
            <span style={{ fontWeight: 600, color: theme.text }}>{selected.size}</span> member{selected.size !== 1 ? "s" : ""} ang ipi-print
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={onClose} style={{ background: theme.surface2, color: theme.textMuted, padding: "9px 18px", borderRadius: 9, fontSize: 13, border: `1px solid ${theme.border}` }}>
              Cancel
            </button>
            <button className="btn" onClick={doPrint} disabled={selected.size === 0}
              style={{ background: selected.size === 0 ? theme.surface3 : "linear-gradient(135deg,#10b981,#059669)", color: selected.size === 0 ? theme.textMuted : "white", padding: "9px 20px", borderRadius: 9, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: selected.size === 0 ? "not-allowed" : "pointer", boxShadow: selected.size > 0 ? "0 4px 14px rgba(16,185,129,.3)" : "none" }}>
              <Icon name="print" size={14} /> Print {selected.size > 0 ? `${selected.size} Card${selected.size !== 1 ? "s" : ""}` : ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { MembersView, BulkPrintModal };
export default MembersView;
