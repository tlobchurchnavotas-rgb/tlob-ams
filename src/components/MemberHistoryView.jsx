import { useMemo, useState } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { getQRDataUrl } from "../utils/qr.js";

// ─── MEMBER ATTENDANCE HISTORY (REPORT PAGE) ───────────────────────────────────
function MemberHistoryView({ attendance, members, events, theme, showNotif }) {
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(members[0]?.id || "");
  const [memberFrom, setMemberFrom] = useState("");
  const [memberTo, setMemberTo] = useState("");

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const label = `${m.name || ""} ${m.id || ""} ${m.ministry || ""} ${m.ageGroup || ""}`.toLowerCase();
      return label.includes(q);
    });
  }, [memberSearch, members]);

  const member = useMemo(
    () => members.find((m) => m.id === selectedMember) || null,
    [members, selectedMember]
  );

  const memberAttendance = useMemo(() => {
    const rows = attendance.filter((a) => a.memberId === selectedMember);

    const filtered = rows.filter((a) => {
      const d = new Date(a.timestamp);
      const isoDate = Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
      if (memberFrom && (!isoDate || isoDate < memberFrom)) return false;
      if (memberTo && (!isoDate || isoDate > memberTo)) return false;
      return true;
    });

    return filtered
      .slice()
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [attendance, selectedMember, memberFrom, memberTo]);

  const exportMemberCSV = () => {
    if (!member) { showNotif("Please select a member", "warning"); return; }
    if (!memberAttendance.length) { showNotif("No attendance records to export", "warning"); return; }

    const header = ["Member ID", "Member Name", "Event", "Event Date", "Check-in", "Ministry"];
    const escapeCsv = (v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const rows = memberAttendance.map((a) => {
      const ev = events.find((e) => e.id === a.eventId);
      const d = new Date(a.timestamp);
      const dateStr = Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
      const timeStr = Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString();
      return [
        a.memberId,
        a.memberName,
        ev?.name || a.eventId,
        ev?.date || "",
        `${dateStr} ${timeStr}`.trim(),
        member.ministry || "",
      ].map(escapeCsv).join(",");
    });

    const filterLabel = [
      `Member: ${member.name} (${member.id})`,
      memberFrom ? `From: ${memberFrom}` : null,
      memberTo ? `To: ${memberTo}` : null,
    ].filter(Boolean).join(" • ");

    const csv = [`# ${filterLabel}`, header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `TLOB_${member.name.replace(/\s+/g, "_")}_Attendance_${ts}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotif("Member history CSV exported!");
  };

  const exportMemberPDF = async () => {
    if (!member) { showNotif("Please select a member", "warning"); return; }
    if (!memberAttendance.length) { showNotif("No attendance records to export", "warning"); return; }

    const dataUrl = await getQRDataUrl(
      `TLOB-MEMBER:${member.id}:${member.name}`,
      { width: 21 * 3, margin: 0, color: { dark: "#10b981", light: "#ffffff" } }
    );
    const qrImg = `<img src="${dataUrl}" width="${21 * 3}" height="${21 * 3}"/>`;
    const win = window.open("", "_blank");

    const esc = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const range = [memberFrom ? `From ${memberFrom}` : null, memberTo ? `To ${memberTo}` : null].filter(Boolean).join(" • ");
    const generatedAt = new Date().toLocaleString();

    win.document.write(`<!DOCTYPE html><html><head><title>TLOB Member Attendance History</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;max-width:900px;margin:36px auto;color:#0f172a;}
      .header{display:flex;align-items:center;gap:18px;border-bottom:3px solid #10b981;padding-bottom:18px;margin-bottom:18px;}
      .logo{width:52px;height:52px;background:linear-gradient(135deg,#10b981,#22c55e);border-radius:13px;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;flex-shrink:0;}
      h1{font-size:20px;margin:0;}h2{font-size:13px;color:#10b981;margin:4px 0 0;font-weight:400;}
      .sub{font-size:12px;color:#475569;margin-top:6px;line-height:1.6;}
      .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0 18px;}
      .mc{background:#f1f5f9;border-radius:10px;padding:12px;text-align:center;}
      .mc .v{font-size:22px;font-weight:800;color:#10b981;}.mc .l{font-size:11px;color:#64748b;margin-top:2px;}
      table{width:100%;border-collapse:collapse;}
      th{background:#10b981;color:white;padding:9px 12px;text-align:left;font-size:12px;}
      td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;}
      tr:nth-child(even) td{background:#f8fafc;}
      code{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;font-size:12px;}
      .footer{margin-top:26px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;}
      @media print{.footer{position:fixed;bottom:0;width:100%;}}
    </style></head><body>
    <div class="header">
      <div class="logo">👤</div>
      <div>
        <h1>TLOB Church — Member Attendance History</h1>
        <h2>${esc(member.name)} <span style="color:#64748b;font-weight:600">(${esc(member.id)})</span></h2>
        <div class="sub">
          <div><b>Ministry:</b> ${esc(member.ministry || "—")} &nbsp; <b>Age Group:</b> ${esc(member.ageGroup || "—")}</div>
          <div><b>Range:</b> ${esc(range || "All dates")}</div>
        </div>
      </div>
      <div style="margin-left:auto">${qrImg}</div>
    </div>
    <div class="meta">
      <div class="mc"><div class="v">${memberAttendance.length}</div><div class="l">Total Records</div></div>
      <div class="mc"><div class="v">${esc(memberFrom || "—")}</div><div class="l">From</div></div>
      <div class="mc"><div class="v">${esc(memberTo || "—")}</div><div class="l">To</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Event</th><th>Event Date</th><th>Check-in</th></tr></thead><tbody>
      ${memberAttendance.map((a, i) => {
        const ev = events.find((e) => e.id === a.eventId);
        const d = new Date(a.timestamp);
        const timeStr = Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString();
        return `<tr>
          <td>${i + 1}</td>
          <td><strong>${esc(ev?.name || a.eventId)}</strong></td>
          <td>${esc(ev?.date || "")}</td>
          <td><code>${esc(timeStr)}</code></td>
        </tr>`;
      }).join("")}
    </tbody></table>
    <div class="footer">Generated by TLOB Attendance Management System • ${esc(generatedAt)}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
    showNotif("Member history PDF ready!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 22 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Member Attendance History</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <label>Select Member</label>
            <input
              type="text"
              placeholder="Search member (name, ID, ministry)..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <select value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)}>
              {filteredMembers.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.id})</option>)}
            </select>
            {memberSearch.trim() && (
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
                Showing {filteredMembers.length} of {members.length}
              </div>
            )}
          </div>
          <div style={{ minWidth: 160 }}>
            <label>From</label>
            <input type="date" value={memberFrom} onChange={(e) => setMemberFrom(e.target.value)} />
          </div>
          <div style={{ minWidth: 160 }}>
            <label>To</label>
            <input type="date" value={memberTo} onChange={(e) => setMemberTo(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 9 }}>
            <button className="btn" onClick={exportMemberCSV} style={{ background: `${theme.success}15`, color: theme.success, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="download" size={15} /> Export CSV
            </button>
            <button className="btn" onClick={exportMemberPDF} style={{ background: theme.accent, color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="print" size={15} /> Print / PDF
            </button>
          </div>
        </div>

        <div style={{ marginTop: 16, color: theme.textMuted, fontSize: 12 }}>
          {memberAttendance.length} record{memberAttendance.length !== 1 ? "s" : ""} found
          {memberFrom || memberTo ? ` • Filtered by date range` : ""}
        </div>
      </div>

      {member && (
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, overflow: "hidden" }}>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(135deg,${theme.success}0d,${theme.accent2}08)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar member={member} size={34} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{member.name}</div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{member.id} • {member.ministry || "—"} • {member.ageGroup || "—"}</div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: theme.success }}>{memberAttendance.length}</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>Records</div>
            </div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Event</th><th>Event Date</th><th>Check-in</th></tr></thead>
            <tbody>
              {memberAttendance.map((a, i) => {
                const ev = events.find((e) => e.id === a.eventId);
                const d = new Date(a.timestamp);
                const timeStr = Number.isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <tr key={a.id || `${a.memberId}_${a.eventId}_${a.timestamp}`}>
                    <td style={{ color: theme.textMuted, fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{ev?.name || a.eventId}</td>
                    <td style={{ color: theme.textMuted, fontSize: 12 }}>{ev?.date || "—"}</td>
                    <td style={{ fontSize: 12 }}>
                      <span style={{ background: `${theme.success}12`, color: theme.success, borderRadius: 5, padding: "2px 7px" }}>{timeStr}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {memberAttendance.length === 0 && <div style={{ padding: 36, textAlign: "center", color: theme.textMuted }}>No records found</div>}
        </div>
      )}
    </div>
  );
}

export default MemberHistoryView;

