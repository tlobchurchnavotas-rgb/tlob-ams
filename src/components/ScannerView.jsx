import { useState } from "react";
import { CHURCH_LOGO_SRC } from "../constants.js";

// ─── SCANNER VIEW (merged with Kiosk launcher) ────────────────────────────────
function ScannerView({ events, theme, onLaunchKiosk }) {
  const [selectedEvent, setSelectedEvent] = useState(events.find(e => e.status === "Active")?.id || "");
  const activeEvent = events.find(e => e.id === selectedEvent);

  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      width: "100%",
      height: "87vh", 
      background: `linear-gradient(135deg, ${theme.bg}CC, ${theme.bg})`,
      fontFamily: "'DM Sans', sans-serif",
      overflow: "hidden"
    }}>
      {/* Card Container */}
      <div style={{ 
        background: theme.surface,
        borderRadius: 24,
        padding: "32px 32px",
        boxShadow: `0 25px 80px ${theme.accent}18, inset 0 1px 0 ${theme.border}`,
        border: `1px solid ${theme.border}`,
        width: "100%",
        maxWidth: "620px",
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        gap: 18,
        overflow: "visible"
      }}>
        
        {/* Church Branding Header */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          gap: 12,
          textAlign: "center",
          width: "100%"
        }}>
          <img 
            src={CHURCH_LOGO_SRC} 
            alt="Church Logo" 
            style={{ 
              width: 110, 
              height: 110, 
              objectFit: "contain",
              borderRadius: 0,
              background: "none",
              padding: 0,
            }} 
          />
          <div style={{ width: "100%" }}>
            <div style={{ 
              fontSize: 32, 
              fontWeight: 800, 
              color: theme.text,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              marginBottom: 8
            }}>
              TLOB Church
            </div>
            <div style={{ 
              fontSize: 13, 
              color: theme.textMuted,
              fontWeight: 600,
              letterSpacing: "0.04em",
              lineHeight: 1.4,
              textTransform: "uppercase"
            }}>
              Attendance Kiosk Mode
            </div>
          </div>
        </div>

        {/* Welcome Section */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          gap: 8,
          textAlign: "center",
          width: "100%"
        }}>
          <div style={{ 
            fontSize: 28, 
            fontWeight: 700, 
            color: theme.text,
            letterSpacing: "-0.01em",
            lineHeight: 1.2
          }}>
            Welcome!
          </div>
          <div style={{ 
            fontSize: 15, 
            color: theme.textMuted,
            lineHeight: 1.6,
            maxWidth: "100%"
          }}>
            Scan QR codes or enter member IDs to mark attendance quickly and efficiently.
          </div>
        </div>

        {/* Event Selector */}
        <div style={{ 
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 10
        }}>
          <label style={{ 
            fontSize: 12, 
            fontWeight: 700, 
            color: theme.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.06em"
          }}>
            Select Event to Monitor
          </label>
          <select 
            value={selectedEvent} 
            onChange={e => setSelectedEvent(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "14px 16px", 
              background: theme.surface2, 
              border: `1.5px solid ${theme.border}`, 
              borderRadius: 12, 
              color: theme.text, 
              fontSize: 15,
              fontWeight: 600,
              outline: "none",
              fontFamily: "inherit",
              cursor: "pointer",
              transition: "all 0.2s",
              lineHeight: 1.4
            }}
            onFocus={(e) => { e.target.style.borderColor = theme.accent; e.target.style.boxShadow = `0 0 0 3px ${theme.accent}15`; }}
            onBlur={(e) => { e.target.style.borderColor = theme.border; e.target.style.boxShadow = "none"; }}
          >
            <option value="">— Select Event —</option>
            {events.filter(e => e.status === "Active" || e.status === "Upcoming").map(e => (
              <option key={e.id} value={e.id} style={{ background: theme.bg, color: theme.text }}>
                {e.name} ({e.date})
              </option>
            ))}
          </select>
        </div>

        {/* Active Event Badge */}
        {activeEvent && (
          <div style={{ 
            width: "100%",
            padding: "14px 16px",
            background: `${theme.accent}10`,
            border: `1.5px solid ${theme.accent}35`,
            borderRadius: 12,
            textAlign: "center"
          }}>
            <div style={{ 
              fontSize: 11, 
              color: theme.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              fontWeight: 700,
              marginBottom: 8,
              lineHeight: 1.3
            }}>
              Currently Selected
            </div>
            <div style={{ 
              fontSize: 17, 
              fontWeight: 700, 
              color: theme.accent,
              marginBottom: 6,
              lineHeight: 1.2
            }}>
              {activeEvent.name}
            </div>
            <div style={{ 
              fontSize: 13, 
              color: theme.textMuted,
              fontWeight: 500,
              lineHeight: 1.3
            }}>
              {activeEvent.date} • {activeEvent.time}
            </div>
          </div>
        )}

        {/* Launch Button */}
        <button 
          className="btn"
          onClick={() => onLaunchKiosk(selectedEvent)}
          disabled={!selectedEvent}
          style={{ 
            width: "100%",
            background: !selectedEvent ? `${theme.accent}40` : `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`, 
            color: "white", 
            border: "none",
            borderRadius: 13, 
            padding: "16px 24px", 
            fontSize: 16, 
            fontWeight: 800, 
            cursor: !selectedEvent ? "not-allowed" : "pointer", 
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            boxShadow: !selectedEvent ? "none" : `0 12px 32px ${theme.accent}28`,
            transition: "all 0.3s ease",
            letterSpacing: "-0.02em",
            opacity: !selectedEvent ? 0.55 : 1,
            lineHeight: 1.3
          }}
          onMouseEnter={(e) => { if (selectedEvent) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 16px 40px ${theme.accent}38`; } }}
          onMouseLeave={(e) => { if (selectedEvent) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 12px 32px ${theme.accent}28`; } }}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor">
            <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/>
          </svg>
          Launch Kiosk Mode
        </button>

        {/* Info Text */}
        <div style={{ 
          fontSize: 13, 
          color: theme.textMuted,
          textAlign: "center",
          opacity: 0.7,
          lineHeight: 1.4
        }}>
          Select an event above to begin taking attendance
        </div>
      </div>
    </div>
  );
}

export default ScannerView;
