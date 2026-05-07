import { useMemo, useState } from "react";
import { Icon } from "./Icon.jsx";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d, weekStartsOn = 1) {
  // weekStartsOn: 0=Sun, 1=Mon
  const x = startOfDay(d);
  const day = x.getDay();
  const diff = (day - weekStartsOn + 7) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

function addDays(d, days) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function startOfMonth(d) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

function addMonths(d, months) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

function clampPct(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(-999, Math.min(999, n));
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return String(d);
  }
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function parseTsSafe(value) {
  const t = new Date(value);
  return Number.isFinite(t?.getTime?.()) ? t : null;
}

function uniqueCount(rows, key) {
  return new Set((rows || []).map((r) => r?.[key]).filter(Boolean)).size;
}

function inRange(t, a, b) {
  return t >= a && t < b;
}

function groupLabel(name, type) {
  const n = (name || "").trim();
  const t = (type || "").trim();
  if (n && t) return `${n} • ${t}`;
  return n || t || "—";
}

function AttendanceAnalyticsView({ attendance, members, events, theme }) {
  const [refDate, setRefDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [weekStartsOn, setWeekStartsOn] = useState(1); // Monday by default
  const [compareWeekA, setCompareWeekA] = useState(() => {
    const w = startOfWeek(new Date(), 1);
    return w.toISOString().slice(0, 10);
  });
  const [compareWeekB, setCompareWeekB] = useState(() => {
    const w = startOfWeek(addDays(new Date(), -7), 1);
    return w.toISOString().slice(0, 10);
  });
  const [compareGroup, setCompareGroup] = useState("");

  const stats = useMemo(() => {
    const ref = startOfDay(new Date(refDate));
    const w0 = startOfWeek(ref, weekStartsOn);
    const w1 = addDays(w0, 7);
    const wPrev0 = addDays(w0, -7);
    const wPrev1 = w0;

    const m0 = startOfMonth(ref);
    const m1 = addMonths(m0, 1);
    const mPrev0 = addMonths(m0, -1);
    const mPrev1 = m0;

    const takeRange = (a0, a1) => {
      const rows = [];
      for (const a of attendance || []) {
        const t = parseTsSafe(a?.timestamp);
        if (!t) continue;
        if (inRange(t, a0, a1)) rows.push({ ...a, _t: t });
      }
      return rows;
    };

    const weekRows = takeRange(w0, w1);
    const prevWeekRows = takeRange(wPrev0, wPrev1);
    const monthRows = takeRange(m0, m1);
    const prevMonthRows = takeRange(mPrev0, mPrev1);

    const count = (rows) => rows.length;

    // Per-day breakdown for the selected week (bars)
    const weekByDay = Array.from({ length: 7 }, (_, i) => {
      const d0 = addDays(w0, i);
      const d1 = addDays(w0, i + 1);
      const rows = weekRows.filter((r) => inRange(r._t, d0, d1));
      return {
        label: d0.toLocaleDateString([], { weekday: "short" }),
        date: d0,
        total: rows.length,
        uniqueMembers: uniqueCount(rows, "memberId"),
        uniqueEvents: uniqueCount(rows, "eventId"),
      };
    });

    // Per-week breakdown for the selected month (up to 6 calendar weeks)
    const monthWeeks = (() => {
      const s = startOfWeek(m0, weekStartsOn);
      const out = [];
      for (let i = 0; i < 6; i++) {
        const a0 = addDays(s, i * 7);
        const a1 = addDays(s, (i + 1) * 7);
        const rows = monthRows.filter((r) => inRange(r._t, a0, a1));
        // Only include weeks that overlap the month.
        if (a0 >= m1 || a1 <= m0) continue;
        out.push({
          label: `${fmtDate(a0)} – ${fmtDate(addDays(a1, -1))}`,
          start: a0,
          end: a1,
          total: rows.length,
          uniqueMembers: uniqueCount(rows, "memberId"),
          uniqueEvents: uniqueCount(rows, "eventId"),
        });
      }
      return out;
    })();

    const monthTopEvents = (() => {
      const byEvent = new Map();
      for (const r of monthRows) {
        const id = r?.eventId || "—";
        byEvent.set(id, (byEvent.get(id) || 0) + 1);
      }
      const rows = Array.from(byEvent.entries())
        .map(([eventId, total]) => {
          const ev = (events || []).find((e) => e.id === eventId);
          return {
            eventId,
            eventName: ev?.name || eventId,
            eventDate: ev?.date || "",
            total,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 6);
      return rows;
    })();

    const totalMembers = (members || []).filter((m) => !m?.archived).length;
    const monthUniqueMembers = uniqueCount(monthRows, "memberId");
    const monthCoverage = totalMembers ? (monthUniqueMembers / totalMembers) * 100 : 0;

    const out = {
      ref,
      ranges: { w0, w1, wPrev0, wPrev1, m0, m1, mPrev0, mPrev1 },
      week: {
        total: count(weekRows),
        uniqueMembers: uniqueCount(weekRows, "memberId"),
        uniqueEvents: uniqueCount(weekRows, "eventId"),
      },
      prevWeek: {
        total: count(prevWeekRows),
        uniqueMembers: uniqueCount(prevWeekRows, "memberId"),
        uniqueEvents: uniqueCount(prevWeekRows, "eventId"),
      },
      month: {
        total: count(monthRows),
        uniqueMembers: monthUniqueMembers,
        uniqueEvents: uniqueCount(monthRows, "eventId"),
        coveragePct: monthCoverage,
      },
      prevMonth: {
        total: count(prevMonthRows),
        uniqueMembers: uniqueCount(prevMonthRows, "memberId"),
        uniqueEvents: uniqueCount(prevMonthRows, "eventId"),
      },
      weekByDay,
      monthWeeks,
      monthTopEvents,
      totals: { members: totalMembers },
    };

    return out;
  }, [attendance, events, members, refDate, weekStartsOn]);

  const compare = useMemo(() => {
    const allEvents = events || [];

    // Group events by recurring identity: name + type
    const groupsMap = new Map();
    for (const e of allEvents) {
      const key = `${(e?.name || "").trim()}||${(e?.type || "").trim()}`;
      if (!key || key === "||") continue;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, { key, name: e?.name || "", type: e?.type || "", eventIds: [] });
      }
      groupsMap.get(key).eventIds.push(e?.id);
    }

    // Prefer Weekly Service groups first, then everything else
    const groups = Array.from(groupsMap.values()).sort((a, b) => {
      const aw = String(a.type || "").toLowerCase().includes("weekly");
      const bw = String(b.type || "").toLowerCase().includes("weekly");
      if (aw !== bw) return aw ? -1 : 1;
      return groupLabel(a.name, a.type).localeCompare(groupLabel(b.name, b.type));
    });

    const defaultKey = groups[0]?.key || "";
    const selectedKey = compareGroup || defaultKey;
    const selected = groups.find((g) => g.key === selectedKey) || null;

    const weekA0 = startOfWeek(startOfDay(new Date(compareWeekA)), weekStartsOn);
    const weekA1 = addDays(weekA0, 7);
    const weekB0 = startOfWeek(startOfDay(new Date(compareWeekB)), weekStartsOn);
    const weekB1 = addDays(weekB0, 7);

    const takeWeekForGroup = (a0, a1) => {
      const rows = [];
      if (!selected) return rows;
      const ids = new Set((selected.eventIds || []).filter(Boolean));
      for (const a of attendance || []) {
        if (!ids.has(a?.eventId)) continue;
        const t = parseTsSafe(a?.timestamp);
        if (!t) continue;
        if (inRange(t, a0, a1)) rows.push({ ...a, _t: t });
      }
      return rows;
    };

    const rowsA = takeWeekForGroup(weekA0, weekA1);
    const rowsB = takeWeekForGroup(weekB0, weekB1);

    const uniqMembersA = new Set(rowsA.map((r) => r?.memberId).filter(Boolean));
    const uniqMembersB = new Set(rowsB.map((r) => r?.memberId).filter(Boolean));

    const onlyA = Array.from(uniqMembersA).filter((id) => !uniqMembersB.has(id));
    const onlyB = Array.from(uniqMembersB).filter((id) => !uniqMembersA.has(id));
    const both = Array.from(uniqMembersA).filter((id) => uniqMembersB.has(id));

    const nameByMemberId = new Map((members || []).map((m) => [m?.id, m?.name]).filter((x) => x[0]));
    const memberName = (id) => nameByMemberId.get(id) || (rowsA.find((r) => r.memberId === id)?.memberName) || (rowsB.find((r) => r.memberId === id)?.memberName) || id;

    return {
      groups,
      selectedKey,
      selected,
      weekA: { start: weekA0, end: weekA1, total: rowsA.length, uniqueMembers: uniqMembersA.size, rows: rowsA },
      weekB: { start: weekB0, end: weekB1, total: rowsB.length, uniqueMembers: uniqMembersB.size, rows: rowsB },
      delta: {
        totalPct: clampPct(pctChange(rowsA.length, rowsB.length)),
        uniqPct: clampPct(pctChange(uniqMembersA.size, uniqMembersB.size)),
      },
      overlap: {
        both: both.length,
        onlyA: onlyA.map((id) => ({ id, name: memberName(id) })).sort((x, y) => String(x.name).localeCompare(String(y.name))),
        onlyB: onlyB.map((id) => ({ id, name: memberName(id) })).sort((x, y) => String(x.name).localeCompare(String(y.name))),
      },
    };
  }, [attendance, compareGroup, compareWeekA, compareWeekB, events, members, weekStartsOn]);

  const StatCard = ({ title, value, sub, tone = "neutral" }) => {
    const palette =
      tone === "good"
        ? { bg: `${theme.success}14`, color: theme.success }
        : tone === "bad"
          ? { bg: `${theme.danger}14`, color: theme.danger }
          : tone === "warn"
            ? { bg: `${theme.warning}14`, color: theme.warning }
            : { bg: theme.surface2, color: theme.text };

    return (
      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: theme.textMuted, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, color: theme.text }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
          </div>
          <div style={{ padding: "6px 10px", borderRadius: 999, background: palette.bg, color: palette.color, border: `1px solid ${theme.border}`, fontWeight: 800, fontSize: 11, whiteSpace: "nowrap" }}>
            {tone === "good" ? "Up" : tone === "bad" ? "Down" : tone === "warn" ? "Flat" : "Info"}
          </div>
        </div>
      </div>
    );
  };

  const DeltaPill = ({ current, previous }) => {
    const raw = pctChange(current, previous);
    const pct = clampPct(raw);
    const tone = pct > 0.5 ? "good" : pct < -0.5 ? "bad" : "warn";
    const color = tone === "good" ? theme.success : tone === "bad" ? theme.danger : theme.warning;
    const bg = `${color}14`;
    const sign = pct > 0 ? "+" : "";
    const label = previous ? `${sign}${pct.toFixed(1)}% vs prev` : current ? "New" : "—";
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: bg, color, fontSize: 11, fontWeight: 800, border: `1px solid ${theme.border}` }}>
        <Icon name={tone === "good" ? "check" : tone === "bad" ? "close" : "menu"} size={14} />
        {label}
      </span>
    );
  };

  const maxWeekDay = Math.max(1, ...stats.weekByDay.map((d) => d.total));
  const maxMonthWeek = Math.max(1, ...stats.monthWeeks.map((w) => w.total));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Attendance Analytics</div>
            <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 4 }}>
              Weekly and monthly summaries with comparison and percentage change.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, width: "100%" }}>
            <div>
              <label>Reference date</label>
              <input type="date" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
            </div>
            <div>
              <label>Week starts on</label>
              <select value={weekStartsOn} onChange={(e) => setWeekStartsOn(Number(e.target.value))}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14, color: theme.textMuted, fontSize: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="events" size={16} /> Week: {fmtDate(stats.ranges.w0)} – {fmtDate(addDays(stats.ranges.w1, -1))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="events" size={16} /> Month: {new Date(stats.ranges.m0).toLocaleDateString([], { month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Weekly Service Comparison</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
              Choose a weekly service, then compare Week A vs Week B.
            </div>
          </div>
          <div style={{ display: "grid", gap: 10, width: "100%" }}>
            <div style={{ maxWidth: 520 }}>
              <label>Weekly service / event</label>
              <select
                value={compare.selectedKey}
                onChange={(e) => setCompareGroup(e.target.value)}
              >
                {compare.groups.map((g) => (
                  <option key={g.key} value={g.key}>
                    {groupLabel(g.name, g.type)}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, width: "100%", alignItems: "end" }}>
              <div>
                <label>Week A (any date)</label>
                <input type="date" value={compareWeekA} onChange={(e) => setCompareWeekA(e.target.value)} />
              </div>
              <div>
                <label>Week B (any date)</label>
                <input type="date" value={compareWeekB} onChange={(e) => setCompareWeekB(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12, marginTop: 14 }}>
          <div style={{ gridColumn: "span 6", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 12, color: theme.textMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>Week A</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{fmtDate(compare.weekA.start)} – {fmtDate(addDays(compare.weekA.end, -1))}</div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: theme.text }}>{compare.weekA.total}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>Check-ins</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: theme.text }}>{compare.weekA.uniqueMembers}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>Unique members</div>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: "span 6", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 12, color: theme.textMuted, letterSpacing: ".08em", textTransform: "uppercase" }}>Week B</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>{fmtDate(compare.weekB.start)} – {fmtDate(addDays(compare.weekB.end, -1))}</div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: theme.text }}>{compare.weekB.total}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>Check-ins</div>
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 900, color: theme.text }}>{compare.weekB.uniqueMembers}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>Unique members</div>
              </div>
            </div>
          </div>

          <div style={{ gridColumn: "span 12", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 800 }}>Change (A vs B):</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: `${theme.accent}12`, border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>Check-ins</span>
                <strong style={{ color: theme.text }}>{compare.weekA.total - compare.weekB.total}</strong>
                <span style={{ color: theme.textMuted, fontWeight: 800, fontSize: 11 }}>
                  ({compare.delta.totalPct > 0 ? "+" : ""}{compare.delta.totalPct.toFixed(1)}%)
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: `${theme.accent2}12`, border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>Unique members</span>
                <strong style={{ color: theme.text }}>{compare.weekA.uniqueMembers - compare.weekB.uniqueMembers}</strong>
                <span style={{ color: theme.textMuted, fontWeight: 800, fontSize: 11 }}>
                  ({compare.delta.uniqPct > 0 ? "+" : ""}{compare.delta.uniqPct.toFixed(1)}%)
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 999, background: theme.surface2, border: `1px solid ${theme.border}` }}>
                <span style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>Overlap</span>
                <strong style={{ color: theme.text }}>{compare.overlap.both}</strong>
                <span style={{ color: theme.textMuted, fontWeight: 800, fontSize: 11 }}>members attended both</span>
              </span>
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="events" size={15} />
              Week selection snaps to your “Week starts on” setting.
            </div>
          </div>

          <div style={{ gridColumn: "span 6", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 12 }}>Attended in A (not B)</div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>{compare.overlap.onlyA.length}</div>
            </div>
            <div style={{ maxHeight: 220, overflow: "auto", padding: 12 }}>
              {!compare.overlap.onlyA.length ? (
                <div style={{ fontSize: 12, color: theme.textMuted, textAlign: "center", padding: 16 }}>None</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {compare.overlap.onlyA.slice(0, 20).map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 700 }}>{m.name}</div>
                      <div style={{ color: theme.textMuted, fontFamily: "DM Mono, monospace", fontSize: 11 }}>{m.id}</div>
                    </div>
                  ))}
                  {compare.overlap.onlyA.length > 20 && (
                    <div style={{ fontSize: 11, color: theme.textMuted, textAlign: "center", paddingTop: 6 }}>
                      Showing first 20
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ gridColumn: "span 6", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 900, fontSize: 12 }}>Attended in B (not A)</div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>{compare.overlap.onlyB.length}</div>
            </div>
            <div style={{ maxHeight: 220, overflow: "auto", padding: 12 }}>
              {!compare.overlap.onlyB.length ? (
                <div style={{ fontSize: 12, color: theme.textMuted, textAlign: "center", padding: 16 }}>None</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {compare.overlap.onlyB.slice(0, 20).map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 700 }}>{m.name}</div>
                      <div style={{ color: theme.textMuted, fontFamily: "DM Mono, monospace", fontSize: 11 }}>{m.id}</div>
                    </div>
                  ))}
                  {compare.overlap.onlyB.length > 20 && (
                    <div style={{ fontSize: 11, color: theme.textMuted, textAlign: "center", paddingTop: 6 }}>
                      Showing first 20
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 12 }}>
        <div style={{ gridColumn: "span 6" }}>
          <StatCard
            title="This week attendance"
            value={stats.week.total}
            sub={
              <span>
                Unique members: <strong style={{ color: theme.text }}>{stats.week.uniqueMembers}</strong> • Unique events:{" "}
                <strong style={{ color: theme.text }}>{stats.week.uniqueEvents}</strong> • <DeltaPill current={stats.week.total} previous={stats.prevWeek.total} />
              </span>
            }
            tone={pctChange(stats.week.total, stats.prevWeek.total) > 0.5 ? "good" : pctChange(stats.week.total, stats.prevWeek.total) < -0.5 ? "bad" : "warn"}
          />
        </div>
        <div style={{ gridColumn: "span 6" }}>
          <StatCard
            title="This month attendance"
            value={stats.month.total}
            sub={
              <span>
                Unique members: <strong style={{ color: theme.text }}>{stats.month.uniqueMembers}</strong> /{" "}
                <strong style={{ color: theme.text }}>{stats.totals.members || "—"}</strong> • Coverage:{" "}
                <strong style={{ color: theme.text }}>{stats.totals.members ? `${stats.month.coveragePct.toFixed(1)}%` : "—"}</strong> •{" "}
                <DeltaPill current={stats.month.total} previous={stats.prevMonth.total} />
              </span>
            }
            tone={pctChange(stats.month.total, stats.prevMonth.total) > 0.5 ? "good" : pctChange(stats.month.total, stats.prevMonth.total) < -0.5 ? "bad" : "warn"}
          />
        </div>

        <div className="card" style={{ gridColumn: "span 6", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Weekly breakdown (by day)</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>Total check-ins</div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "flex-end", height: 130 }}>
            {stats.weekByDay.map((d) => (
              <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                <div title={`${fmtDate(d.date)} • ${d.total} check-ins`} style={{ width: "100%", height: `${Math.round((d.total / maxWeekDay) * 100)}%`, minHeight: 6, background: `linear-gradient(180deg,${theme.accent},${theme.accent2})`, borderRadius: 10, border: `1px solid ${theme.border}`, boxShadow: darkModeShadow(theme) }} />
                <div style={{ fontSize: 10, color: theme.textMuted, fontWeight: 800 }}>{d.label}</div>
                <div style={{ fontSize: 11, color: theme.text, fontWeight: 800 }}>{d.total}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: theme.textMuted }}>
            Tip: this counts check-ins (attendance rows). If a member checks into multiple events, they are counted multiple times.
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 6", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Monthly breakdown (by week)</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>Total check-ins</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            {stats.monthWeeks.map((w) => (
              <div key={w.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 210, fontSize: 11, color: theme.textMuted, fontWeight: 800 }}>{w.label}</div>
                <div style={{ flex: 1, height: 10, background: theme.surface2, borderRadius: 999, border: `1px solid ${theme.border}`, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round((w.total / maxMonthWeek) * 100)}%`, background: `linear-gradient(90deg,${theme.accent},${theme.accent2})` }} />
                </div>
                <div style={{ width: 48, textAlign: "right", fontWeight: 800, color: theme.text }}>{w.total}</div>
              </div>
            ))}
            {!stats.monthWeeks.length && <div style={{ color: theme.textMuted, fontSize: 12, padding: "10px 0" }}>No attendance records for this month.</div>}
          </div>
        </div>

        <div className="card" style={{ gridColumn: "span 12", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Top events this month</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>By attendance rows</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th style={{ textAlign: "right" }}>Check-ins</th>
              </tr>
            </thead>
            <tbody>
              {stats.monthTopEvents.map((r) => (
                <tr key={r.eventId}>
                  <td style={{ fontWeight: 700 }}>{r.eventName}</td>
                  <td style={{ color: theme.textMuted }}>{r.eventDate || "—"}</td>
                  <td style={{ textAlign: "right", fontWeight: 800 }}>{r.total}</td>
                </tr>
              ))}
              {!stats.monthTopEvents.length && (
                <tr>
                  <td colSpan={3} style={{ padding: 18, textAlign: "center", color: theme.textMuted }}>
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function darkModeShadow(theme) {
  // small helper to keep bars readable in both themes
  return theme?.bg === "#080d18" ? "0 10px 24px rgba(0,0,0,.35)" : "0 10px 24px rgba(99,102,241,.15)";
}

export default AttendanceAnalyticsView;

