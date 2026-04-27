import { useState } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { QRCode, getQRDataUrl } from "../utils/qr.js";
import { CHURCH_LOGO_SRC } from "../constants.js";


function MemberProfile({ member, attendance, events, members, theme, showNotif }) {
  const memberAtt = attendance.filter(a => a.memberId === member.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const [showQRCard, setShowQRCard] = useState(false);
  const qrValue = `TLOB:${member.id}:${member.name}`;
  const derivedAgeGroup = member.ageGroup || "";

  // eslint-disable-next-line no-unused-vars
  const printQRCard = async (targetMember = member) => {
    const m = targetMember;
    const qrVal = `TLOB:${m.id}:${m.name}`;
    const dataUrl = await getQRDataUrl(qrVal, { width: 100, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } });
    const win = window.open("", "_blank");
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>QR Card - ${m.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: "Inter", system-ui, sans-serif;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    
    @page {
      size: letter;
      margin: 0.3in;
    }
    
    .card {
      width: 100%;
      max-width: 420px;
      aspect-ratio: 2.5 / 3.2;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      background: white;
      gap: 10px;
    }
    
    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 5px;
    }
    
    .card-logo {
      width: 28px;
      height: 28px;
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
      padding: 8px;
      border: 1.5px solid #144dbe;
      border-radius: 6px;
      background: #f9fafb;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .qr-box img {
      width: 110px;
      height: 110px;
      display: block;
    }
    
    .card-name {
      font-weight: 700;
      font-size: 14px;
      text-align: center;
      color: #000;
      max-width: 100%;
      line-height: 1.2;
      margin-top: 2px;
    }
    
    .card-info {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 100%;
      flex: 1;
      justify-content: flex-end;
    }
    
    .card-status-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      width: 100%;
    }
    
    .tag {
      padding: 3px 6px;
      border-radius: 3px;
      background: #f3f4f6;
      color: #374151;
      border: 0.5px solid #d1d5db;
      font-size: 8px;
      white-space: nowrap;
    }
    
    .tag-status {
      background: #e0f2fe;
      color: #0369a1;
      border-color: #06b6d4;
      font-weight: 600;
      font-size: 8px;
      padding: 3px 6px;
    }
    
    .card-footer {
      width: 100%;
      text-align: center;
      font-size: 7px;
      font-weight: 600;
      color: #666;
      border-top: 1px solid #e5e7eb;
      padding-top: 3px;
      margin-top: 2px;
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
    
    @media print {
      body { padding: 0; }
      .card { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <img class="card-logo" src="${CHURCH_LOGO_SRC}" alt="Logo">
      <div class="card-title">TLOB<br>Member ID</div>
    </div>
    
    <div class="qr-box">
      <img src="${dataUrl}" alt="QR">
    </div>
    
    <div class="card-name">${m.name}</div>
    
    <div class="card-info">
      <div class="card-status-row">
        <span class="tag">${m.id}</span>
        <div class="tag tag-status">
          <span class="dot ${m.status === "Active" ? "dot-active" : "dot-inactive"}"></span>
          ${m.status}
        </div>
      </div>
      <div class="card-footer">For Attendance</div>
    </div>
  </div>
</body>
</html>`;

    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
    if (targetMember === member) showNotif("QR Card sent to printer!");
  };

  const attendanceRate = events.length > 0 ? Math.round((memberAtt.length / events.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Profile Header */}
      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, rgba(99,102,241,.18), rgba(6,182,212,.1))", padding: "28px 28px 0" }}>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
            <div style={{ position: "relative" }}>
              <Avatar member={member} size={88} style={{ border: `4px solid ${theme.surface}` }} />
              <div style={{ position: "absolute", bottom: 2, right: 2, width: 18, height: 18, borderRadius: "50%", background: member.status === "Active" ? theme.success : theme.danger, border: `3px solid ${theme.surface}` }} />
            </div>
            <div style={{ paddingBottom: 20, flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.02em" }}>{member.name}</div>
              <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 3 }}>
                {member.ministry || "No Ministry"} • Joined {member.joined}{derivedAgeGroup ? ` • ${derivedAgeGroup}` : ""}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <span className={`badge tag-${member.status.toLowerCase()}`}>{member.status}</span>
                <span style={{ background: theme.surface2, color: theme.textMuted, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{member.id}</span>
              </div>
            </div>
            <div style={{ paddingBottom: 20, display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setShowQRCard(!showQRCard)} style={{ background: theme.surface2, color: theme.text, padding: "8px 16px", borderRadius: 8, fontSize: 13, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="qr" size={14} /> View QR
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showQRCard ? "2fr 1fr" : "1fr", gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {[
              { label: "Events Attended", value: memberAtt.length, color: theme.accent },
              { label: "Attendance Rate", value: `${attendanceRate}%`, color: theme.success },
              { label: "Age Group", value: derivedAgeGroup || "—", color: theme.accent2, small: true },
            ].map((s, i) => (
              <div key={i} className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 11, padding: 16 }}>
                <div style={{ fontSize: s.small ? 14 : 26, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Attendance History */}
          <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${theme.border}`, fontWeight: 600, fontSize: 14 }}>Attendance History</div>
            {memberAtt.length === 0
              ? <div style={{ padding: 30, textAlign: "center", color: theme.textMuted, fontSize: 13 }}>No attendance records</div>
              : <table>
                <thead><tr><th>#</th><th>Event</th><th>Date</th><th>Check-in Time</th></tr></thead>
                <tbody>
                  {memberAtt.map((a, i) => {
                    const ev = events.find(e => e.id === a.eventId);
                    return (
                      <tr key={a.id}>
                        <td style={{ color: theme.textMuted, fontSize: 12 }}>{i + 1}</td>
                        <td style={{ fontWeight: 500, fontSize: 13 }}>{ev?.name || "Unknown Event"}</td>
                        <td style={{ color: theme.textMuted, fontSize: 13 }}>{new Date(a.timestamp).toLocaleDateString()}</td>
                        <td><span style={{ background: `${theme.success}15`, color: theme.success, borderRadius: 5, padding: "2px 8px", fontSize: 12 }}>{new Date(a.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
          </div>
        </div>

        {/* QR Card Panel */}
        {showQRCard && (
          <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 13, padding: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14, alignSelf: "flex-start" }}>QR Code</div>
            <div style={{ background: "white", borderRadius: 14, padding: 16, boxShadow: "0 0 0 6px rgba(99,102,241,.12)" }}>
              <QRCode value={qrValue} size={160} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{member.name}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>{member.id}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontFamily: "DM Mono,monospace", marginTop: 6, wordBreak: "break-all", background: theme.surface2, padding: "6px 10px", borderRadius: 6 }}>{qrValue}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberProfile;
