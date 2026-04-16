import { useMemo, useState } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { DonutChart } from "./Charts.jsx";
import { AGE_GROUPS } from "../constants.js";
import { LineChart } from "./Charts.jsx";

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardView({ members, events, attendance, theme }) {
  const [weekMonthCursor, setWeekMonthCursor] = useState(() => new Date());
  const [yearCursor, setYearCursor] = useState(() => new Date().getFullYear());
  const [newMembersWeekMonthCursor, setNewMembersWeekMonthCursor] = useState(() => new Date());
  const [newMembersYearCursor, setNewMembersYearCursor] = useState(() => new Date().getFullYear());

  const active = members.filter(m => m.status === "Active" && !m.archived).length;
  const todayEvent = events.find(e => e.status === "Active");
  const todayAtt = todayEvent ? attendance.filter(a => a.eventId === todayEvent.id).length : 0;
  const total = members.filter(m => !m.archived).length;
  const recent = [...attendance].reverse().slice(0, 5);

  const monthLabel = useMemo(() => weekMonthCursor.toLocaleString(undefined, { month: "long", year: "numeric" }), [weekMonthCursor]);
  const newMembersMonthLabel = useMemo(() => newMembersWeekMonthCursor.toLocaleString(undefined, { month: "long", year: "numeric" }), [newMembersWeekMonthCursor]);

  const weeklyAttendanceData = useMemo(() => {
    const y = weekMonthCursor.getFullYear();
    const m = weekMonthCursor.getMonth(); // 0-11
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil(daysInMonth / 7); // typically 4-5
    const counts = new Array(weeks).fill(0);

    for (const a of attendance) {
      const dt = new Date(a.timestamp);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y || dt.getMonth() !== m) continue;
      const weekIndex = Math.floor((dt.getDate() - 1) / 7); // 0-based
      if (weekIndex >= 0 && weekIndex < counts.length) counts[weekIndex] += 1;
    }

    const mon = weekMonthCursor.toLocaleString(undefined, { month: "short" });
    return counts.map((v, i) => ({ label: `W${i + 1} ${mon}`, value: v }));
  }, [attendance, weekMonthCursor]);

  const yearlyAttendanceData = useMemo(() => {
    const y = yearCursor;
    const counts = new Array(12).fill(0);
    for (const a of attendance) {
      const dt = new Date(a.timestamp);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y) continue;
      counts[dt.getMonth()] += 1;
    }
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return counts.map((v, i) => ({ label: monthNames[i], value: v }));
  }, [attendance, yearCursor]);

  const weeklyNewMembersData = useMemo(() => {
    const y = newMembersWeekMonthCursor.getFullYear();
    const m = newMembersWeekMonthCursor.getMonth(); // 0-11
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil(daysInMonth / 7); // typically 4-5
    const counts = new Array(weeks).fill(0);

    for (const mem of members) {
      if (mem?.archived) continue;
      const dt = new Date(mem?.joined);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y || dt.getMonth() !== m) continue;
      const weekIndex = Math.floor((dt.getDate() - 1) / 7); // 0-based
      if (weekIndex >= 0 && weekIndex < counts.length) counts[weekIndex] += 1;
    }

    const mon = newMembersWeekMonthCursor.toLocaleString(undefined, { month: "short" });
    return counts.map((v, i) => ({ label: `W${i + 1} ${mon}`, value: v }));
  }, [members, newMembersWeekMonthCursor]);

  const yearlyNewMembersData = useMemo(() => {
    const y = newMembersYearCursor;
    const counts = new Array(12).fill(0);
    for (const mem of members) {
      if (mem?.archived) continue;
      const dt = new Date(mem?.joined);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y) continue;
      counts[dt.getMonth()] += 1;
    }
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return counts.map((v, i) => ({ label: monthNames[i], value: v }));
  }, [members, newMembersYearCursor]);

  // ── REAL DATA: attendance count per event ──
  const eventChartData = events.map(ev => ({
    label: ev.name.split(" ")[0],
    value: attendance.filter(a => a.eventId === ev.id).length,
  }));

  // ── REAL DATA: members per ministry ──
  const ministries = [...new Set(members.filter(m => m.ministry && !m.archived).map(m => m.ministry))];
  const ministryData = ministries.slice(0, 6).map(min => ({
    label: min.split(" ")[0],
    value: members.filter(m => m.ministry === min && !m.archived).length,
  }));

  // ── REAL DATA: members per age group ──
  const ageGroupData = AGE_GROUPS.map((g) => ({
    label: g,
    value: members.filter((m) => {
      if (m.archived) return false;
      return m.ageGroup === g;
    }).length,
  }));

  // ── Inline real-data bar chart ──
  function RealBar({ data, color, colors }) {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 90, padding: "0 2px" }}>
        {data.map((d, i) => (
          (() => {
            const c = d.color ?? (colors && colors[i % colors.length]) ?? color;
            return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: theme.text, opacity: d.value > 0 ? 1 : 0 }}>{d.value}</span>
            <div style={{ width: "100%", borderRadius: "4px 4px 0 0", height: `${(d.value / max) * 64}px`, minHeight: d.value > 0 ? 6 : 2, background: `linear-gradient(180deg,${c},${c}99)`, transition: "height .6s ease" }} />
            <span style={{ fontSize: 9, color: theme.textMuted, whiteSpace: "nowrap" }}>{d.label}</span>
          </div>
            );
          })()
        ))}
      </div>
    );
  }

  const barPalette = [
    theme.accent,
    theme.success,
    theme.warning,
    theme.danger,
    theme.accent2,
    "#8b5cf6", // violet
    "#06b6d4", // cyan
    "#f97316", // orange
  ].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14 }}>
        {[
          { label: "Total Members", value: total, sub: `${active} active`, color: theme.accent, icon: "members" },
          { label: "Today's Attendance", value: todayAtt, sub: todayEvent?.name || "No active event", color: theme.success, icon: "check" },
          { label: "All-time Records", value: attendance.length, sub: "Attendance entries", color: theme.accent2, icon: "analytics" },
          { label: "Upcoming Events", value: events.filter(e => e.status === "Upcoming").length, sub: "Scheduled", color: theme.warning, icon: "events" },
        ].map((s, i) => (
          <div key={i} className="card" style={{ position: "relative", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18, paddingRight: 60, animationDelay: `${i * .08}s` }}>
            <div style={{ position: "absolute", top: 14, right: 14, width: 38, height: 38, borderRadius: 9, background: `${s.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
              <Icon name={s.icon} size={19} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-.03em" }}>{s.value}</div>
            <div style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row — REAL DATA */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 260px", gap: 14 }}>
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Attendance per Event</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 12 }}>Actual check-in counts</div>
          <RealBar data={eventChartData} color={theme.accent} colors={barPalette} />
        </div>
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Members per Ministry</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 12 }}>Current distribution</div>
          <RealBar data={ministryData} color={theme.accent2} colors={barPalette} />
        </div>
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>Members per Age Group</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 12 }}>Kids · Youth · Young Pro · Adult · Senior</div>
          <RealBar data={ageGroupData} color={theme.warning} colors={barPalette} />
        </div>
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>Member Status</div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>Active vs Inactive</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}><DonutChart filled={active} total={total} color={theme.success} /></div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: theme.textMuted }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: theme.success }} />Active: {active}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: theme.textMuted }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: theme.danger }} />Inactive: {total - active}</div>
          </div>
        </div>
      </div>

      {/* Attendance trends */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Weekly Attendance</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="btn"
                onClick={() => setWeekMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.border}`, display: "flex" }}
                title="Previous month"
              >
                <Icon name="back" size={14} />
              </button>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>{monthLabel}</div>
              <button
                className="btn"
                onClick={() => setWeekMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.border}`, display: "flex", transform: "rotate(180deg)" }}
                title="Next month"
              >
                <Icon name="back" size={14} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>Attendance entries per week</div>
          <LineChart data={weeklyAttendanceData} color={theme.accent} />
        </div>

        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>Yearly Attendance</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="btn"
                onClick={() => setYearCursor((y) => y - 1)}
                style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.border}`, display: "flex" }}
                title="Previous year"
              >
                <Icon name="back" size={14} />
              </button>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>{yearCursor}</div>
              <button
                className="btn"
                onClick={() => setYearCursor((y) => y + 1)}
                style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.border}`, display: "flex", transform: "rotate(180deg)" }}
                title="Next year"
              >
                <Icon name="back" size={14} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>Attendance entries per month</div>
          <LineChart data={yearlyAttendanceData} color={theme.accent2} />
        </div>

        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>New Members (Weekly)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="btn"
                onClick={() => setNewMembersWeekMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.border}`, display: "flex" }}
                title="Previous month"
              >
                <Icon name="back" size={14} />
              </button>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>{newMembersMonthLabel}</div>
              <button
                className="btn"
                onClick={() => setNewMembersWeekMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.border}`, display: "flex", transform: "rotate(180deg)" }}
                title="Next month"
              >
                <Icon name="back" size={14} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>New members joined per week</div>
          <LineChart data={weeklyNewMembersData} color={theme.success} />
        </div>

        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>New Members (Yearly)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                className="btn"
                onClick={() => setNewMembersYearCursor((y) => y - 1)}
                style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.border}`, display: "flex" }}
                title="Previous year"
              >
                <Icon name="back" size={14} />
              </button>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent }}>{newMembersYearCursor}</div>
              <button
                className="btn"
                onClick={() => setNewMembersYearCursor((y) => y + 1)}
                style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 8px", borderRadius: 8, border: `1px solid ${theme.border}`, display: "flex", transform: "rotate(180deg)" }}
                title="Next year"
              >
                <Icon name="back" size={14} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 10 }}>New members joined per month</div>
          <LineChart data={yearlyNewMembersData} color={theme.warning} />
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Recent Check-ins</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map((a, i) => {
              const ev = events.find(e => e.id === a.eventId);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: theme.surface2, borderRadius: 8 }}>
                  <Avatar member={{ name: a.memberName }} size={30} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.memberName}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev?.name}</div>
                  </div>
                  <div style={{ fontSize: 10, color: theme.textMuted, whiteSpace: "nowrap" }}>{new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>Events Overview</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {events.slice(0, 5).map((ev, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: theme.surface2, borderRadius: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: ev.status === "Active" ? theme.success : ev.status === "Upcoming" ? theme.warning : theme.textMuted, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.name}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{ev.date} • {ev.time}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: theme.accent }}>{attendance.filter(a => a.eventId === ev.id).length}</span>
                  <span className={`badge tag-${ev.status.toLowerCase()}`}>{ev.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 14 }}>🎂 Upcoming Celebrations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {(() => {
              const today = new Date();
              const getDaysUntil = ds => { if (!ds) return null; const [,mm,dd] = ds.split("-"); const n = new Date(today.getFullYear(), parseInt(mm)-1, parseInt(dd)); if (n < today) n.setFullYear(today.getFullYear()+1); return Math.ceil((n - today)/(86400000)); };
              const upcoming = members.filter(m => !m.archived).flatMap(m => {
                const r = [];
                if (m.birthday) { const d = getDaysUntil(m.birthday); if (d !== null && d <= 30) r.push({ member: m, type: "birthday", daysUntil: d }); }
                if (m.anniversary) { const d = getDaysUntil(m.anniversary); if (d !== null && d <= 30) r.push({ member: m, type: "anniversary", daysUntil: d }); }
                return r;
              }).sort((a,b) => a.daysUntil - b.daysUntil).slice(0, 5);
              if (upcoming.length === 0) return <div style={{ color: theme.textMuted, fontSize: 12, textAlign: "center", padding: "20px 0" }}>No celebrations in the next 30 days</div>;
              return upcoming.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", background: theme.surface2, borderRadius: 8 }}>
                  <span style={{ fontSize: 18 }}>{c.type === "birthday" ? "🎂" : "💍"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{c.member.name}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted }}>{c.type === "birthday" ? "Birthday" : "Anniversary"}</div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: c.daysUntil === 0 ? theme.success : c.daysUntil <= 7 ? theme.warning : theme.textMuted }}>
                    {c.daysUntil === 0 ? "Today!" : `${c.daysUntil}d`}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
