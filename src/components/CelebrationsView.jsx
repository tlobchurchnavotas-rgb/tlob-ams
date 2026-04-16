import { useState } from "react";
import Avatar from "./Avatar.jsx";


// ─── CELEBRATIONS VIEW ────────────────────────────────────────────────────────
function CelebrationsView({ members, theme }) {
  const today = new Date();
  const [windowDays, setWindowDays] = useState(30);

  const getDaysUntil = dateStr => {
    if (!dateStr) return null;
    const [, mm, dd] = dateStr.split("-");
    const next = new Date(today.getFullYear(), parseInt(mm) - 1, parseInt(dd));
    if (next < today) next.setFullYear(today.getFullYear() + 1);
    return Math.ceil((next - today) / (1000 * 60 * 60 * 24));
  };

  const celebrations = members
    .filter(m => !m.archived)
    .flatMap(m => {
      const items = [];
      if (m.birthday) { const d = getDaysUntil(m.birthday); if (d !== null && d <= windowDays) items.push({ member: m, type: "birthday", date: m.birthday, daysUntil: d }); }
      if (m.anniversary) { const d = getDaysUntil(m.anniversary); if (d !== null && d <= windowDays) items.push({ member: m, type: "anniversary", date: m.anniversary, daysUntil: d }); }
      return items;
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const todayItems = celebrations.filter(c => c.daysUntil === 0);
  const upcomingItems = celebrations.filter(c => c.daysUntil > 0);

  const formatDate = dateStr => {
    if (!dateStr) return "";
    const [, mm, dd] = dateStr.split("-");
    return new Date(2000, parseInt(mm) - 1, parseInt(dd)).toLocaleDateString("en-PH", { month: "long", day: "numeric" });
  };

  const CelebCard = ({ c, highlight }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: highlight ? `${c.type === "birthday" ? theme.accent : theme.accent2}12` : theme.surface2, borderRadius: 12, border: `1px solid ${highlight ? (c.type === "birthday" ? theme.accent : theme.accent2) + "30" : theme.border}`, animation: "fadeUp .3s ease" }}>
      <div style={{ fontSize: 32 }}>{c.type === "birthday" ? "🎂" : "💍"}</div>
      <Avatar member={c.member} size={40} />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{c.member.name}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{c.type === "birthday" ? "Birthday" : "Wedding Anniversary"} • {formatDate(c.date)}</div>
        {c.member.ministry && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{c.member.ministry}</div>}
      </div>
      <div style={{ textAlign: "center" }}>
        {c.daysUntil === 0
          ? <div style={{ background: `${c.type === "birthday" ? theme.accent : theme.accent2}20`, color: c.type === "birthday" ? theme.accent : theme.accent2, borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 800 }}>Today! 🎉</div>
          : <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: c.daysUntil <= 7 ? theme.warning : theme.textMuted }}>{c.daysUntil}</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>days away</div>
            </div>
        }
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Window selector */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: theme.textMuted, marginRight: 4 }}>Show within:</span>
        {[7, 14, 30, 60].map(d => (
          <button key={d} className="btn" onClick={() => setWindowDays(d)}
            style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: windowDays === d ? theme.accent : theme.surface2, color: windowDays === d ? "white" : theme.textMuted, border: `1px solid ${theme.border}` }}>
            {d} days
          </button>
        ))}
      </div>

      {/* Today */}
      {todayItems.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
            🎉 Celebrating Today
            <span style={{ background: `${theme.success}15`, color: theme.success, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>{todayItems.length}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {todayItems.map((c, i) => <CelebCard key={i} c={c} highlight />)}
          </div>
        </div>
      )}

      {/* Upcoming */}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          📅 Upcoming ({windowDays} days)
          <span style={{ background: `${theme.accent}12`, color: theme.accent, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800 }}>{upcomingItems.length}</span>
        </div>
        {upcomingItems.length === 0 && todayItems.length === 0
          ? <div style={{ padding: 40, textAlign: "center", color: theme.textMuted, background: theme.surface, borderRadius: 13, border: `1px solid ${theme.border}` }}>No celebrations in the next {windowDays} days 🎈<br /><span style={{ fontSize: 12 }}>Add birthdays and anniversaries in the Members page.</span></div>
          : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcomingItems.map((c, i) => <CelebCard key={i} c={c} highlight={false} />)}
            </div>
        }
      </div>
    </div>
  );
}

export default CelebrationsView;
