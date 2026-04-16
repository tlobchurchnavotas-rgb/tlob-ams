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

  const printQRCard = async (targetMember = member) => {
    const m = targetMember;
    const qrVal = `TLOB:${m.id}:${m.name}`;
    const dataUrl = await getQRDataUrl(qrVal, { width: 105, margin: 0, color: { dark: "#1a1a2e", light: "#ffffff" } });
    const qrImg = `<img src="${dataUrl}" width="105" height="105" alt="QR"/>`;
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>QR ID Card - ${m.name}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Inter',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f1f5f9;padding:20px;}
      .card{width:300px;background:white;border-radius:20px;overflow:hidden;box-shadow:0 12px 48px rgba(0,0,0,.15);}
      .header{background:linear-gradient(160deg,#0f172a 0%,#1e2d4d 100%);padding:22px 20px 18px;display:flex;align-items:center;gap:14px;}
      .logo{width:52px;height:52px;border-radius:50%;border:2px solid rgba(255,255,255,.25);object-fit:cover;flex-shrink:0;}
      .header-text .church-name{font-size:12px;font-weight:700;color:white;line-height:1.2;}
      .header-text .church-sub{font-size:9px;color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:.08em;margin-top:2px;}
      .body{padding:22px 20px;}
      .qr-container{display:flex;justify-content:center;margin-bottom:18px;}
      .qr-wrap{padding:10px;border:1.5px solid #e2e8f0;border-radius:12px;display:inline-block;}
      .member-info{text-align:center;margin-bottom:16px;}
      .member-name{font-size:17px;font-weight:800;color:#0f172a;letter-spacing:-.02em;margin-bottom:5px;}
      .member-id{display:inline-block;font-size:11px;color:#64748b;font-family:monospace;background:#f1f5f9;padding:3px 10px;border-radius:999px;margin-bottom:6px;}
      .ministry{display:inline-block;font-size:11px;color:#6366f1;font-weight:600;background:rgba(99,102,241,.08);padding:3px 12px;border-radius:999px;border:1px solid rgba(99,102,241,.2);}
      .divider{height:1px;background:#f1f5f9;margin:14px 0;}
      .footer{display:flex;justify-content:space-between;align-items:center;}
      .footer-label{font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;}
      .footer-value{font-size:10px;color:#475569;font-weight:600;}
      .status-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:${m.status === "Active" ? "#10b981" : "#ef4444"};margin-right:4px;vertical-align:middle;}
      @media print{body{background:white;padding:0;}.card{box-shadow:none;margin:0;}}
    </style></head>
    <body><div class="card">
      <div class="header">
        <img class="logo" src="${CHURCH_LOGO_SRC}" alt="TLOB Logo" />
        <div class="header-text">
          <div class="church-name">The Lord Our Banner</div>
          <div class="church-sub">Assemblies of God · Since 1988</div>
          <div class="church-sub" style="color:rgba(99,102,241,.8);margin-top:3px;">Member ID Card</div>
        </div>
      </div>
      <div class="body">
        <div class="qr-container"><div class="qr-wrap">${qrImg}</div></div>
        <div class="member-info">
          <div class="member-name">${m.name}</div>
          <div><div class="member-id">${m.id}</div></div>
          ${m.ministry ? `<div style="margin-top:6px"><div class="ministry">${m.ministry}</div></div>` : ""}
        </div>
        <div class="divider"></div>
        <div class="footer">
          <div><div class="footer-label">Status</div><div class="footer-value"><span class="status-dot"></span>${m.status}</div></div>
          <div style="text-align:right"><div class="footer-label">Member Since</div><div class="footer-value">${m.joined || "—"}</div></div>
        </div>
      </div>
    </div></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
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
              <button className="btn" onClick={printQRCard} style={{ background: theme.accent, color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="print" size={14} /> Print QR Card
              </button>
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
            <button className="btn" onClick={printQRCard} style={{ background: theme.accent, color: "white", padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="print" size={14} /> Print ID Card
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MemberProfile;
