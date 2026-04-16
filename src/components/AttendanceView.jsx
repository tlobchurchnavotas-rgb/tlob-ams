import { useState } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";


// ─── ATTENDANCE VIEW ──────────────────────────────────────────────────────────
function AttendanceView({ attendance, members, events, theme, onViewProfile }) {
  const [filterEvent, setFilterEvent] = useState("all");
  const [search, setSearch] = useState("");
  const filtered = attendance.filter(a =>
    (filterEvent === "all" || a.eventId === filterEvent) &&
    a.memberName.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}><Icon name="search" size={15} /></div>
          <input type="text" placeholder="Search member..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34 }} />
        </div>
        <select value={filterEvent} onChange={e => setFilterEvent(e.target.value)} style={{ width: 220 }}>
          <option value="all">All Events</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.name} ({e.date})</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {events.slice(0, 4).map(e => (
          <div key={e.id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "11px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent }}>{attendance.filter(a => a.eventId === e.id).length}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{e.name}</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>{e.date}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, overflow: "hidden" }}>
        <table>
          <thead><tr><th>#</th><th>Member</th><th>Event</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
          <tbody>
            {[...filtered].reverse().map((a, i) => {
              const ev = events.find(e => e.id === a.eventId);
              const mem = members.find(m => m.id === a.memberId) || { name: a.memberName };
              return (
                <tr key={a.id}>
                  <td style={{ color: theme.textMuted, fontSize: 11 }}>{i + 1}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }} onClick={() => mem.id && onViewProfile(mem)}>
                      <Avatar member={mem} size={26} />
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{a.memberName}</span>
                    </div>
                  </td>
                  <td style={{ color: theme.textMuted, fontSize: 13 }}>{ev?.name || "—"}</td>
                  <td style={{ color: theme.textMuted, fontSize: 12 }}>{new Date(a.timestamp).toLocaleDateString()}</td>
                  <td style={{ fontSize: 12 }}><span style={{ background: `${theme.success}12`, color: theme.success, borderRadius: 5, padding: "2px 7px" }}>{new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></td>
                  <td><span className="badge tag-active">Present</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 36, textAlign: "center", color: theme.textMuted }}>No records found</div>}
      </div>
    </div>
  );
}

export default AttendanceView;
