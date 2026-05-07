import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [sharedEventFilter, setSharedEventFilter] = useState("all");

  const active = members.filter(m => m.status === "Active" && !m.archived).length;
  const todayEvent = events.find(e => e.status === "Active");
  const todayAtt = todayEvent ? attendance.filter(a => a.eventId === todayEvent.id).length : 0;
  const total = members.filter(m => !m.archived).length;
  const recent = [...attendance].reverse().slice(0, 5);

  const monthLabel = useMemo(() => weekMonthCursor.toLocaleString(undefined, { month: "long", year: "numeric" }), [weekMonthCursor]);
  const newMembersMonthLabel = useMemo(() => newMembersWeekMonthCursor.toLocaleString(undefined, { month: "long", year: "numeric" }), [newMembersWeekMonthCursor]);
  const eventGroups = useMemo(() => {
    const groups = new Map();
    for (const ev of events) {
      const rawName = (ev?.name || "").trim();
      if (!rawName) continue;
      const key = `group:${rawName.toLowerCase()}`;
      const existing = groups.get(key);
      if (existing) {
        existing.eventIds.push(ev.id);
      } else {
        groups.set(key, { id: key, name: rawName, eventIds: [ev.id] });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [events]);
  const eventIdToGroupId = useMemo(() => {
    const map = new Map();
    for (const group of eventGroups) {
      for (const eventId of group.eventIds) {
        map.set(eventId, group.id);
      }
    }
    return map;
  }, [eventGroups]);
  const attendanceForTrend = useMemo(
    () => (
      sharedEventFilter === "all"
        ? attendance
        : attendance.filter((a) => eventIdToGroupId.get(a.eventId) === sharedEventFilter)
    ),
    [attendance, sharedEventFilter, eventIdToGroupId]
  );
  const membersForTrend = useMemo(
    () => (
      sharedEventFilter === "all"
        ? members
        : members.filter((m) => eventIdToGroupId.get(m.sourceEventId || "") === sharedEventFilter)
    ),
    [members, sharedEventFilter, eventIdToGroupId]
  );

  const weeklyAttendanceData = useMemo(() => {
    const y = weekMonthCursor.getFullYear();
    const m = weekMonthCursor.getMonth(); // 0-11
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil(daysInMonth / 7); // typically 4-5
    const counts = new Array(weeks).fill(0);

    for (const a of attendanceForTrend) {
      const dt = new Date(a.timestamp);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y || dt.getMonth() !== m) continue;
      const weekIndex = Math.floor((dt.getDate() - 1) / 7); // 0-based
      if (weekIndex >= 0 && weekIndex < counts.length) counts[weekIndex] += 1;
    }

    const mon = weekMonthCursor.toLocaleString(undefined, { month: "short" });
    return counts.map((v, i) => ({ label: `W${i + 1} ${mon}`, value: v }));
  }, [attendanceForTrend, weekMonthCursor]);

  const yearlyAttendanceData = useMemo(() => {
    const y = yearCursor;
    const counts = new Array(12).fill(0);
    for (const a of attendanceForTrend) {
      const dt = new Date(a.timestamp);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y) continue;
      counts[dt.getMonth()] += 1;
    }
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return counts.map((v, i) => ({ label: monthNames[i], value: v }));
  }, [attendanceForTrend, yearCursor]);

  const weeklyNewMembersData = useMemo(() => {
    const y = newMembersWeekMonthCursor.getFullYear();
    const m = newMembersWeekMonthCursor.getMonth(); // 0-11
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil(daysInMonth / 7); // typically 4-5
    const counts = new Array(weeks).fill(0);

    for (const mem of membersForTrend) {
      if (mem?.archived) continue;
      const dt = new Date(mem?.joined);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y || dt.getMonth() !== m) continue;
      const weekIndex = Math.floor((dt.getDate() - 1) / 7); // 0-based
      if (weekIndex >= 0 && weekIndex < counts.length) counts[weekIndex] += 1;
    }

    const mon = newMembersWeekMonthCursor.toLocaleString(undefined, { month: "short" });
    return counts.map((v, i) => ({ label: `W${i + 1} ${mon}`, value: v }));
  }, [membersForTrend, newMembersWeekMonthCursor]);

  const avgWeeklyAttendance = useMemo(() => {
    if (!weeklyAttendanceData.length) return 0;
    const y = weekMonthCursor.getFullYear();
    const m = weekMonthCursor.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let sundayCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(y, m, d).getDay();
      if (day === 0) sundayCount++; // 0 = Sunday
    }
    const total = weeklyAttendanceData.reduce((sum, item) => sum + item.value, 0);
    return sundayCount > 0 ? total / sundayCount : 0;
  }, [weeklyAttendanceData, weekMonthCursor]);

  const avgWeeklyNewMembers = useMemo(() => {
    if (!weeklyNewMembersData.length) return 0;
    const y = newMembersWeekMonthCursor.getFullYear();
    const m = newMembersWeekMonthCursor.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let sundayCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(y, m, d).getDay();
      if (day === 0) sundayCount++; // 0 = Sunday
    }
    const total = weeklyNewMembersData.reduce((sum, item) => sum + item.value, 0);
    return sundayCount > 0 ? total / sundayCount : 0;
  }, [weeklyNewMembersData, newMembersWeekMonthCursor]);

  // ── SMART ALERTS CALCULATIONS ──
  const smartAlerts = useMemo(() => {
    const alerts = [];
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

    // Alert 1: Inactive members (haven't attended in 2 months)
    const inactiveMembers = members.filter(m => {
      if (m.archived || m.status !== "Active") return false;
      const lastAttendance = attendance
        .filter(a => a.memberId ? a.memberId === m.id : a.memberName === m.name)
        .map(a => new Date(a.timestamp))
        .sort((a, b) => b - a)[0];
      return !lastAttendance || lastAttendance < twoMonthsAgo;
    });

    if (inactiveMembers.length > 0) {
      alerts.push({
        id: "inactive",
        type: "inactive",
        icon: "alert",
        title: `${inactiveMembers.length} member${inactiveMembers.length > 1 ? "s" : ""} haven't attended in 2 months`,
        subtitle: "Consider reaching out to reconnect",
        color: theme.danger,
        bgColor: `${theme.danger}12`,
        members: inactiveMembers,
      });
    }

    // Alert 2: Attendance comparison (this month vs last month)
    const thisMonth = new Date();
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
    const thisMonthEnd = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0);
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
    const lastMonthEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

    const thisMonthAtt = attendance.filter(a => {
      const dt = new Date(a.timestamp);
      return dt >= new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1) && dt <= thisMonthEnd;
    }).length;

    const lastMonthAtt = attendance.filter(a => {
      const dt = new Date(a.timestamp);
      return dt >= lastMonthStart && dt <= lastMonthEnd;
    }).length;

    if (lastMonthAtt > 0) {
      const attendanceChange = ((thisMonthAtt - lastMonthAtt) / lastMonthAtt) * 100;
      if (Math.abs(attendanceChange) >= 10) {
        const isUp = attendanceChange > 0;
        alerts.push({
          id: "attendance",
          type: "attendance",
          icon: isUp ? "up" : "down",
          title: `Attendance is ${isUp ? "up" : "down"} ${Math.abs(attendanceChange).toFixed(0)}% vs last month`,
          subtitle: `This month: ${thisMonthAtt} | Last month: ${lastMonthAtt}`,
          color: isUp ? theme.success : theme.warning,
          bgColor: isUp ? `${theme.success}12` : `${theme.warning}12`,
        });
      }
    }

    // Alert 3: New members comparison (this month vs last month)
    const thisMonthNewMembers = members.filter(m => {
      if (m.archived) return false;
      const dt = new Date(m.joined);
      return dt >= new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1) && dt <= thisMonthEnd;
    }).length;

    const lastMonthNewMembers = members.filter(m => {
      if (m.archived) return false;
      const dt = new Date(m.joined);
      return dt >= lastMonthStart && dt <= lastMonthEnd;
    }).length;

    if (lastMonthNewMembers > 0) {
      const newMembersChange = ((thisMonthNewMembers - lastMonthNewMembers) / lastMonthNewMembers) * 100;
      if (Math.abs(newMembersChange) >= 15) {
        const isUp = newMembersChange > 0;
        alerts.push({
          id: "newMembers",
          type: "newMembers",
          icon: isUp ? "up" : "down",
          title: `New members join rate is ${isUp ? "up" : "down"} ${Math.abs(newMembersChange).toFixed(0)}%!`,
          subtitle: `This month: ${thisMonthNewMembers} | Last month: ${lastMonthNewMembers}`,
          color: isUp ? theme.success : theme.warning,
          bgColor: isUp ? `${theme.success}12` : `${theme.warning}12`,
        });
      }
    }

    // Alert 4: Event capacity alerts (if capacity field exists)
    const capacityAlerts = events
      .filter(e => e.capacity && e.capacity > 0)
      .map(e => {
        const eventAtt = attendance.filter(a => a.eventId === e.id).length;
        const capacityPercent = (eventAtt / e.capacity) * 100;
        if (capacityPercent >= 80) {
          return {
            type: "capacity",
            icon: "alert",
            title: `Event "${e.name}" is at ${capacityPercent.toFixed(0)}% capacity`,
            subtitle: "Consider scheduling an additional service",
            color: theme.warning,
            bgColor: `${theme.warning}12`,
          };
        }
        return null;
      })
      .filter(Boolean);

    return [...alerts, ...capacityAlerts];
  }, [members, attendance, events, theme]);

  // ── REAL DATA: attendance count per event ──

  const yearlyNewMembersData = useMemo(() => {
    const y = newMembersYearCursor;
    const counts = new Array(12).fill(0);
    for (const mem of membersForTrend) {
      if (mem?.archived) continue;
      const dt = new Date(mem?.joined);
      if (Number.isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== y) continue;
      counts[dt.getMonth()] += 1;
    }
    const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return counts.map((v, i) => ({ label: monthNames[i], value: v }));
  }, [membersForTrend, newMembersYearCursor]);

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
          { label: "All-time Records ✨", value: attendance.length, sub: "Attendance entries", color: theme.accent2, icon: "analytics" },
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
      <div style={{ display: "grid", gridTemplateColumns: ".5fr 1fr 1fr", gap: 4, alignItems: "center" }}>
        <SearchableEventSelect
          events={eventGroups}
          value={sharedEventFilter}
          onChange={setSharedEventFilter}
          theme={theme}
          allLabel="All Events / Services"
        />

        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 12, minHeight: 52, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 11 }}>Average Attendance</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.accent }}>{avgWeeklyAttendance.toFixed(1)}</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>per week</div>
          </div>
          <div style={{ fontSize: 10, color: theme.textMuted }}>For {monthLabel}</div>
        </div>

        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 12, minHeight: 52, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 11 }}>Average New Members</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.success }}>{avgWeeklyNewMembers.toFixed(1)}</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>per week</div>
          </div>
          <div style={{ fontSize: 10, color: theme.textMuted }}>For {newMembersMonthLabel}</div>
        </div>
      </div>
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
              <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: "nowrap" }}>
                Avg: {weeklyAttendanceData.length > 0 ? (weeklyAttendanceData.reduce((sum, d) => sum + d.value, 0) / weeklyAttendanceData.length).toFixed(1) : 0}/week
              </div>
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
              <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: "nowrap" }}>
                Avg: {weeklyNewMembersData.length > 0 ? (weeklyNewMembersData.reduce((sum, d) => sum + d.value, 0) / weeklyNewMembersData.length).toFixed(1) : 0}/week
              </div>
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

      {/* Smart Alerts */}
      {smartAlerts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
          {smartAlerts.map((alert, idx) => (
            <div
              key={idx}
              className="card"
              style={{
                background: alert.bgColor,
                border: `1.5px solid ${alert.color}`,
                borderRadius: 13,
                padding: 16,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                animation: `slideIn 0.4s ease-out ${idx * 0.08}s both`,
              }}
            >
              <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>
                {alert.type === "inactive" && "⚠️"}
                {alert.type === "attendance" && (alert.icon === "up" ? "📈" : "📉")}
                {alert.type === "newMembers" && (alert.icon === "up" ? "🚀" : "📉")}
                {alert.type === "capacity" && "🏫"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: alert.color, marginBottom: 4 }}>
                  {alert.title}
                </div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>
                  {alert.subtitle}
                </div>
                {alert.members && alert.members.length > 0 && (() => {
                  const maleMembers = alert.members.filter((m) => (m.gender || "").toLowerCase() === "male");
                  const femaleMembers = alert.members.filter((m) => (m.gender || "").toLowerCase() === "female");
                  const otherMembers = alert.members.filter((m) => {
                    const g = (m.gender || "").toLowerCase();
                    return g !== "male" && g !== "female";
                  });
                  return (
                    <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted }}>
                      <div style={{ fontWeight: 500, marginBottom: 10 }}>At-risk members:</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            <span>Male</span>
                            <span style={{ background: theme.surface2, color: theme.textMuted, borderRadius: 999, padding: "0 8px", fontSize: 10, lineHeight: 1.7 }}>{maleMembers.length}</span>
                          </div>
                          {maleMembers.length > 0 ? maleMembers.map((m, i) => (
                            <div key={i} style={{ marginBottom: 4 }}>• {m.name}{m.contact ? ` — ${m.contact}` : ""}</div>
                          )) : <div style={{ color: theme.textMuted, fontSize: 11 }}>No male members</div>}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                            <span>Female</span>
                            <span style={{ background: theme.surface2, color: theme.textMuted, borderRadius: 999, padding: "0 8px", fontSize: 10, lineHeight: 1.7 }}>{femaleMembers.length}</span>
                          </div>
                          {femaleMembers.length > 0 ? femaleMembers.map((m, i) => (
                            <div key={i} style={{ marginBottom: 4 }}>• {m.name}{m.contact ? ` — ${m.contact}` : ""}</div>
                          )) : <div style={{ color: theme.textMuted, fontSize: 11 }}>No female members</div>}
                        </div>
                      </div>
                      {otherMembers.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Other / Unknown</div>
                          {otherMembers.map((m, i) => (
                            <div key={i} style={{ marginBottom: 4 }}>• {m.name}{m.contact ? ` — ${m.contact}` : ""}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Add animation styles
const alertAnimationStyle = document.createElement("style");
alertAnimationStyle.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
if (!document.head.querySelector('style[data-dashboard-alerts]')) {
  alertAnimationStyle.setAttribute('data-dashboard-alerts', 'true');
  document.head.appendChild(alertAnimationStyle);
}

function SearchableEventSelect({ events, value, onChange, theme, allLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const selectedLabel = useMemo(() => {
    if (value === "all") return allLabel;
    const ev = events.find((e) => e.id === value);
    return ev?.name || allLabel;
  }, [value, events, allLabel]);

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((ev) => {
      const name = (ev.name || "").toLowerCase();
      const type = (ev.type || "").toLowerCase();
      const id = (ev.id || "").toLowerCase();
      return name.includes(q) || type.includes(q) || id.includes(q);
    });
  }, [events, query]);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        top: window.scrollY + rect.bottom + 6,
        left: window.scrollX + rect.left,
        width: rect.width,
      });
    };
    updatePos();
    const onDocClick = (evt) => {
      if (!wrapRef.current?.contains(evt.target)) setOpen(false);
    };
    const onEsc = (evt) => {
      if (evt.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 320, zIndex: open ? 1200 : 1 }}>
      <button
        className="btn"
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          background: theme.surface2,
          color: theme.text,
          padding: "8px 10px",
          borderRadius: 8,
          border: `1px solid ${theme.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          fontSize: 12,
        }}
        title={selectedLabel}
      >
        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selectedLabel}</span>
        <Icon name="back" size={12} />
      </button>
      {open && createPortal(
        <div
          style={{
            position: "absolute",
            zIndex: 99999,
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(0,0,0,.2)",
            padding: 8,
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search event/service..."
            style={{ marginBottom: 8 }}
          />
          <div
            onWheel={(e) => e.stopPropagation()}
            style={{
              maxHeight: 240,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <button
              className="btn"
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              style={{
                textAlign: "left",
                background: value === "all" ? theme.accentGlow : theme.surface2,
                color: value === "all" ? theme.accent : theme.text,
                padding: "7px 9px",
                borderRadius: 7,
                border: `1px solid ${theme.border}`,
                fontSize: 12,
              }}
            >
              {allLabel}
            </button>
            {filteredEvents.map((ev) => (
              <button
                key={ev.id}
                className="btn"
                type="button"
                onClick={() => {
                  onChange(ev.id);
                  setOpen(false);
                }}
                style={{
                  textAlign: "left",
                  background: value === ev.id ? theme.accentGlow : theme.surface2,
                  color: value === ev.id ? theme.accent : theme.text,
                  padding: "7px 9px",
                  borderRadius: 7,
                  border: `1px solid ${theme.border}`,
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={ev.name}
              >
                {ev.name}
              </button>
            ))}
            {filteredEvents.length === 0 && (
              <div style={{ fontSize: 12, color: theme.textMuted, padding: "6px 4px" }}>No matching events</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default DashboardView;
