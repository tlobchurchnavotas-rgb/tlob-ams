import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { LineChart } from "./Charts.jsx";
import { getQRDataUrl } from "../utils/qr.js";

function parseAttendanceDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthStart(key) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatMonth(key) {
  return monthStart(key).toLocaleDateString([], { month: "long", year: "numeric" });
}

function formatDate(date) {
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function weeklyChartSvg(rows) {
  const width = 760;
  const height = 220;
  const left = 42;
  const right = 18;
  const top = 28;
  const bottom = 38;
  const chartHeight = height - top - bottom;
  const chartWidth = width - left - right;
  const max = Math.max(...rows.map((row) => row.attendance), 1);
  const points = rows.map((row, index) => {
    const x = rows.length === 1 ? width / 2 : left + (index / (rows.length - 1)) * chartWidth;
    const y = top + chartHeight - (row.attendance / max) * chartHeight;
    return { x, y, row };
  });
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labels = points.map((point) => `<text x="${point.x}" y="${height - 12}" text-anchor="middle" fill="#64748b" font-size="12">W${point.row.week}</text><text x="${point.x}" y="${Math.max(16, point.y - 10)}" text-anchor="middle" fill="#6366f1" font-size="13" font-weight="700">${point.row.attendance}</text>`).join("");
  const dots = points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#6366f1"/>`).join("");
  return `<div class="chart-block"><h2>${rows[0]?.month || "Weekly Attendance"}</h2><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Weekly attendance graph"><line x1="${left}" y1="${top + chartHeight}" x2="${width - right}" y2="${top + chartHeight}" stroke="#cbd5e1"/><polyline points="${pointString}" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg></div>`;
}

// ─── REPORTS VIEW ─────────────────────────────────────────────────────────────
function ReportsView({ attendance, members, events, theme, showNotif }) {
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(events[0]?.id || "");
  const availableMonths = useMemo(() => {
    const year = new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  }, []);
  const [selectedMonths, setSelectedMonths] = useState(() => {
    return [monthKey(new Date())];
  });
  const [monthsInitialized, setMonthsInitialized] = useState(availableMonths.length > 0);
  useEffect(() => {
    if (!monthsInitialized && availableMonths.length) {
      setSelectedMonths([availableMonths[0]]);
      setMonthsInitialized(true);
    }
  }, [availableMonths, monthsInitialized]);
  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const label = `${e.name || ""} ${e.type || ""} ${e.date || ""} ${e.time || ""}`.toLowerCase();
      return label.includes(q) || String(e.id || "").toLowerCase().includes(q);
    });
  }, [eventSearch, events]);

  const eventData = attendance.filter(a => a.eventId === selectedEvent);
  const event = events.find(e => e.id === selectedEvent);

  const weeklySummary = useMemo(() => {
    return selectedMonths.slice().sort().flatMap((key) => {
      const start = monthStart(key);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const rows = [];

      for (let week = 0, weekStart = start; weekStart < end; week += 1, weekStart = addDays(weekStart, 7)) {
        const weekEnd = addDays(weekStart, 7);
        const monthRows = attendance.filter((row) => {
          const date = parseAttendanceDate(row.timestamp);
          return date && date >= start && date < end && date >= weekStart && date < weekEnd;
        });
        rows.push({
          month: formatMonth(key),
          monthKey: key,
          week: week + 1,
          start: new Date(Math.max(start.getTime(), weekStart.getTime())),
          end: new Date(Math.min(end.getTime(), weekEnd.getTime())),
          attendance: monthRows.length,
          members: new Set(monthRows.map((row) => row.memberId).filter(Boolean)).size,
          events: new Set(monthRows.map((row) => row.eventId).filter(Boolean)).size,
        });
      }
      return rows;
    });
  }, [attendance, selectedMonths]);
  const weeklyTotal = weeklySummary.reduce((total, row) => total + row.attendance, 0);
  const weeklyAverage = weeklySummary.length ? (weeklyTotal / weeklySummary.length).toFixed(2) : "0.00";

  const toggleMonth = (key) => {
    setSelectedMonths((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  };

  const exportWeeklyCSV = () => {
    if (!weeklySummary.length) {
      showNotif("Please select at least one month", "warning");
      return;
    }
    const header = ["Month", "Week", "Week Start", "Week End", "Attendance Records", "Unique Members", "Events"];
    const rows = weeklySummary.map((row) => [
      row.month, `Week ${row.week}`, formatDate(row.start), formatDate(addDays(row.end, -1)),
      row.attendance, row.members, row.events,
    ].map(escapeCsv).join(","));
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `TLOB_Weekly_Attendance_${selectedMonths.slice().sort().join("_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showNotif("Weekly summary CSV exported!");
  };

  const exportWeeklyPDF = async () => {
    if (!weeklySummary.length) {
      showNotif("Please select at least one month", "warning");
      return;
    }
    const dataUrl = await getQRDataUrl(
      `TLOB-WEEKLY:${selectedMonths.slice().sort().join(",")}`,
      { width: 21 * 3, margin: 0, color: { dark: "#6366f1", light: "#ffffff" } }
    );
    const qrImg = `<img src="${dataUrl}" width="63" height="63"/>`;
    const win = window.open("", "_blank");
    const rows = weeklySummary.map((row, index) => `<tr><td>${index + 1}</td><td>${row.month}</td><td>Week ${row.week}</td><td>${formatDate(row.start)}</td><td>${formatDate(addDays(row.end, -1))}</td><td>${row.attendance}</td><td>${row.members}</td><td>${row.events}</td></tr>`).join("");
    const charts = selectedMonths.slice().sort().map((key) => weeklyChartSvg(weeklySummary.filter((row) => row.monthKey === key))).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>TLOB Weekly Attendance Summary</title><style>body{font-family:'Segoe UI',sans-serif;max-width:1000px;margin:36px auto;color:#1a1a2e}.header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #6366f1;padding-bottom:20px;margin-bottom:24px}.logo{width:52px;height:52px;background:linear-gradient(135deg,#6366f1,#06b6d4);border-radius:13px;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;flex-shrink:0}h1{font-size:22px;margin:0}h2{font-size:15px;color:#6366f1;margin:3px 0 6px;font-weight:400}.sub{font-size:12px;color:#64748b}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}.mc{background:#f1f5f9;border-radius:10px;padding:13px;text-align:center}.mc .v{font-size:24px;font-weight:700;color:#6366f1}.mc .l{font-size:11px;color:#64748b;margin-top:2px}.chart-block{border:1px solid #e2e8f0;border-radius:10px;padding:14px 18px;margin:18px 0}.chart-block svg{width:100%;height:auto;display:block}table{width:100%;border-collapse:collapse}th{background:#6366f1;color:white;padding:9px 10px;text-align:left;font-size:12px}td{padding:9px 10px;border-bottom:1px solid #e2e8f0;font-size:12px}tr:nth-child(even) td{background:#f8fafc}.footer{margin-top:28px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}@media print{.footer{position:fixed;bottom:0;width:100%}}</style></head><body><div class="header"><div class="logo">⛪</div><div><h1>Attendance Report</h1><h2>Weekly Attendance Summary</h2><div class="sub">Selected months: ${selectedMonths.slice().sort().map(formatMonth).join(", ")}</div></div><div style="margin-left:auto">${qrImg}</div></div><div class="meta"><div class="mc"><div class="v">${weeklyAverage}</div><div class="l">General Average</div></div><div class="mc"><div class="v">${selectedMonths.length}</div><div class="l">Selected Months</div></div><div class="mc"><div class="v">${weeklySummary.length}</div><div class="l">Total Weeks</div></div><div class="mc"><div class="v">${weeklyTotal}</div><div class="l">Total Attendance</div></div></div>${charts}<table><thead><tr><th>#</th><th>Month</th><th>Week</th><th>Week Start</th><th>Week End</th><th>Attendance</th><th>Members</th><th>Events</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Generated by TLOB Attendance Management System - ${new Date().toLocaleString()}</div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
    showNotif("Weekly summary PDF ready!");
  };

  const exportCSV = () => {
    if (!event) return;
    const rows = eventData.map(a => {
      const m = members.find(x => x.id === a.memberId);
      return `${a.memberId},"${a.memberName}","${event.name}",${new Date(a.timestamp).toLocaleDateString()},${new Date(a.timestamp).toLocaleTimeString()},${m?.ministry || ""}`;
    });
    const blob = new Blob([`Member ID,Name,Event,Date,Time,Ministry\n${rows.join("\n")}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `TLOB_${event.name.replace(/\s+/g, "_")}.csv`; link.click();
    showNotif("CSV exported!");
  };

  const exportPDF = async () => {
    if (!event) return;
    const dataUrl = await getQRDataUrl(`TLOB-EVENT:${event.id}`, { width: 21 * 3, margin: 0, color: { dark: "#6366f1", light: "#ffffff" } });
    const qrImg = `<img src="${dataUrl}" width="${21*3}" height="${21*3}"/>`;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>TLOB Report</title>
    <style>body{font-family:'Segoe UI',sans-serif;max-width:820px;margin:36px auto;color:#1a1a2e;}
    .header{display:flex;align-items:center;gap:20px;border-bottom:3px solid #6366f1;padding-bottom:20px;margin-bottom:24px;}
    .logo{width:52px;height:52px;background:linear-gradient(135deg,#6366f1,#06b6d4);border-radius:13px;display:flex;align-items:center;justify-content:center;color:white;font-size:24px;flex-shrink:0;}
    h1{font-size:22px;margin:0;}h2{font-size:14px;color:#6366f1;margin:3px 0 0;font-weight:400;}
    .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
    .mc{background:#f1f5f9;border-radius:10px;padding:13px;text-align:center;}
    .mc .v{font-size:24px;font-weight:700;color:#6366f1;}.mc .l{font-size:11px;color:#64748b;margin-top:2px;}
    table{width:100%;border-collapse:collapse;}
    th{background:#6366f1;color:white;padding:9px 13px;text-align:left;font-size:12px;}
    td{padding:9px 13px;border-bottom:1px solid #e2e8f0;font-size:13px;}
    tr:nth-child(even) td{background:#f8fafc;}
    .badge{display:inline-block;background:rgba(16,185,129,.15);color:#059669;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:600;}
    .footer{margin-top:28px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px;}
    @media print{.footer{position:fixed;bottom:0;width:100%;}}</style></head><body>
    <div class="header"><div class="logo">⛪</div><div><h1>Attendance Report</h1><h2>${event.name}</h2></div><div style="margin-left:auto">${qrImg}</div></div>
    <div class="meta">
      <div class="mc"><div class="v">${eventData.length}</div><div class="l">Attendees</div></div>
      <div class="mc"><div class="v">${event.date}</div><div class="l">Date</div></div>
      <div class="mc"><div class="v">${event.time}</div><div class="l">Time</div></div>
      <div class="mc"><div class="v">${event.type}</div><div class="l">Type</div></div>
    </div>
    <table><thead><tr><th>#</th><th>Member ID</th><th>Full Name</th><th>Ministry</th><th>Check-in</th><th>Status</th></tr></thead><tbody>
    ${eventData.map((a, i) => { const m = members.find(x => x.id === a.memberId); return `<tr><td>${i + 1}</td><td style="font-family:monospace;font-size:12px">${a.memberId}</td><td><strong>${a.memberName}</strong></td><td>${m?.ministry || "—"}</td><td>${new Date(a.timestamp).toLocaleTimeString()}</td><td><span class="badge">Present</span></td></tr>`; }).join("")}
    </tbody></table>
    <div class="footer">Generated by TLOB Attendance Management System • ${new Date().toLocaleString()}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
    showNotif("PDF ready!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 22 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 5 }}>Weekly Attendance Summary</div>
        <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 14 }}>Select one or more months. Each selected month includes only the calendar weeks that overlap that month.</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          {availableMonths.map((key) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${selectedMonths.includes(key) ? theme.accent : theme.border}`, borderRadius: 8, padding: "8px 11px", cursor: "pointer", fontSize: 12 }}>
              <input type="checkbox" checked={selectedMonths.includes(key)} onChange={() => toggleMonth(key)} />
              {formatMonth(key)}
            </label>
          ))}
          {!availableMonths.length && <span style={{ color: theme.textMuted, fontSize: 12 }}>No attendance months available.</span>}
        </div>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button className="btn" onClick={exportWeeklyCSV} style={{ background: `${theme.success}15`, color: theme.success, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}><Icon name="download" size={15} /> Export Weekly CSV</button>
          <button className="btn" onClick={exportWeeklyPDF} style={{ background: theme.accent, color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}><Icon name="print" size={15} /> Print / PDF</button>
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", marginTop: 16, color: theme.textMuted, fontSize: 12 }}>
          <span><strong style={{ color: theme.accent, fontSize: 18 }}>{weeklyAverage}</strong> General Average</span>
          <span><strong style={{ color: theme.accent, fontSize: 18 }}>{weeklyTotal}</strong> Total Attendance</span>
          <span><strong style={{ color: theme.accent, fontSize: 18 }}>{weeklySummary.length}</strong> Total Weeks</span>
        </div>
        {selectedMonths.length > 0 && (
          <div className="dashboard-two-col" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 14, marginTop: 20 }}>
            {selectedMonths.slice().sort().map((key) => {
              const monthRows = weeklySummary.filter((row) => row.monthKey === key);
              return (
                <div key={key} style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: "14px 12px 8px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{formatMonth(key)}</div>
                  <div style={{ color: theme.textMuted, fontSize: 11, marginBottom: 4 }}>Attendance entries per week</div>
                  <LineChart
                    data={monthRows.map((row) => ({ label: `W${row.week}`, value: row.attendance }))}
                    color={theme.accent}
                    height={150}
                    tooltipLabel="Attendance"
                  />
                </div>
              );
            })}
          </div>
        )}
        {weeklySummary.length > 0 && (
          <div style={{ overflowX: "auto", marginTop: 18 }}>
            <table><thead><tr><th>Month</th><th>Week</th><th>Dates</th><th>Attendance</th><th>Members</th><th>Events</th></tr></thead><tbody>
              {weeklySummary.map((row) => <tr key={`${row.monthKey}-${row.week}`}><td>{row.month}</td><td>Week {row.week}</td><td>{formatDate(row.start)} - {formatDate(addDays(row.end, -1))}</td><td>{row.attendance}</td><td>{row.members}</td><td>{row.events}</td></tr>)}
            </tbody></table>
          </div>
        )}
      </div>

      {event && (
        <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, overflow: "hidden" }}>
          <div style={{ padding: 22, borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Generate Specific Attendance Report</div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label>Select Event</label>
                <input
                  type="text"
                  placeholder="Search event..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                  {filteredEvents.map(e => <option key={e.id} value={e.id}>{e.name} ({e.date})</option>)}
                </select>
                {eventSearch.trim() && (
                  <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>
                    Showing {filteredEvents.length} of {events.length}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 9 }}>
                <button className="btn" onClick={exportCSV} style={{ background: `${theme.success}15`, color: theme.success, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="download" size={15} /> Export CSV
                </button>
                <button className="btn" onClick={exportPDF} style={{ background: theme.accent, color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                  <Icon name="print" size={15} /> Print / PDF
                </button>
              </div>
            </div>
          </div>
          <div style={{ padding: "18px 22px", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(135deg,${theme.accent}0d,${theme.accent2}08)` }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Week Attendance Report</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>{event.name} • {event.date} at {event.time}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: theme.accent }}>{eventData.length}</div>
              <div style={{ fontSize: 10, color: theme.textMuted }}>Attendees</div>
            </div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Member ID</th><th>Full Name</th><th>Ministry</th><th>Check-in</th><th>Status</th></tr></thead>
            <tbody>
              {eventData.map((a, i) => {
                const m = members.find(x => x.id === a.memberId);
                return (
                  <tr key={a.id}>
                    <td style={{ color: theme.textMuted, fontSize: 11 }}>{i + 1}</td>
                    <td><code style={{ background: theme.surface2, padding: "2px 6px", borderRadius: 4, fontSize: 11 }}>{a.memberId}</code></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar member={m || { name: a.memberName }} size={24} />
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{a.memberName}</span>
                      </div>
                    </td>
                    <td style={{ color: theme.textMuted, fontSize: 12 }}>{m?.ministry || "—"}</td>
                    <td style={{ fontSize: 12 }}><span style={{ background: `${theme.success}12`, color: theme.success, borderRadius: 5, padding: "2px 7px" }}>{new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></td>
                    <td><span className="badge tag-active">Present</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {eventData.length === 0 && <div style={{ padding: 36, textAlign: "center", color: theme.textMuted }}>No records for this event</div>}
        </div>
      )}
    </div>
  );
}

export default ReportsView;
