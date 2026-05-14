import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { CHURCH_LOGO_SRC, KIOSK_SLIDES } from "../constants.js";


// ─── KIOSK MODE ───────────────────────────────────────────────────────────────
function KioskView({ members, events, attendance, setAttendance, theme, onExit, showNotif, initialEvent }) {
  const [selEv, setSelEv] = useState(() => initialEvent || events.find(e => e.status === "Active")?.id || "");
  const [input, setInput] = useState("");
  const [scanStatus, setScanStatus] = useState(null); // null | {type,member}
  const [recentCheckins, setRecentCheckins] = useState([]);
  const [camState, setCamState] = useState("idle");
  const [camError, setCamError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // iPad 10th gen landscape is 1024px wide; treat it as "narrow" for a better fit.
  const [isNarrow, setIsNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 1100 : false));
  const [isShort, setIsShort] = useState(() => (typeof window !== "undefined" ? window.innerHeight <= 760 : false));
  const [soundEnabled, setSoundEnabled] = useState(true);
  const inputRef = useRef(null);
  const scannerRef = useRef(null);
  const libRef = useRef(null);
  const membersRef = useRef(members); useEffect(() => { membersRef.current = members; }, [members]);
  const attRef = useRef(attendance); useEffect(() => { attRef.current = attendance; }, [attendance]);
  const selEvRef = useRef(selEv); useEffect(() => { selEvRef.current = selEv; }, [selEv]);
  const setAttRef = useRef(setAttendance); useEffect(() => { setAttRef.current = setAttendance; }, [setAttendance]);
  const statusRef = useRef(scanStatus); useEffect(() => { statusRef.current = scanStatus; }, [scanStatus]);
  const activeEv = events.find(e => e.id === selEv);
  const sessionCount = attendance.filter(a => a.eventId === selEv).length;

  const nextId = (list, prefix) => {
    const nums = list.map(x => parseInt(x.id.slice(prefix.length))).filter(n => !isNaN(n));
    return `${prefix}${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(3, "0")}`;
  };

  // Play voice feedback for scan results
  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    try {
      // Cancel any previous speech
      window.speechSynthesis?.cancel();
      
      const utterance = new SpeechSynthesisUtterance();
      utterance.rate = 1.3; // Slightly faster
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      if (type === "success") {
        utterance.text = "Attendance recorded! Welcome!";
        utterance.pitch = 2.1;
      } else if (type === "duplicate") {
        utterance.text = "Already checked in today.";
        utterance.pitch = 0.9;
      } else if (type === "error") {
        utterance.text = "Member not found. Please try again.";
        utterance.pitch = 0.8;
      }
      
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Voice playback failed:", e);
    }
  }, [soundEnabled]);

  const processScan = useCallback((raw) => {
    const val = (raw || "").trim(), evId = selEvRef.current;
    if (!val || !evId || statusRef.current) return;
    const mems = membersRef.current, att = attRef.current;
    const member = mems.find(m => val === `TLOB:${m.id}:${m.name}`) || mems.find(m => m.id === val.toUpperCase()) || mems.find(m => val.toUpperCase().includes(m.id));
    if (!member) { playSound("error"); setScanStatus({ type: "error", member: { name: val } }); setTimeout(() => { setScanStatus(null); inputRef.current?.focus(); }, 2500); return; }
    if (att.find(a => a.memberId === member.id && a.eventId === evId)) { playSound("duplicate"); setScanStatus({ type: "duplicate", member }); setTimeout(() => { setScanStatus(null); inputRef.current?.focus(); }, 2500); return; }
    const newRec = { id: nextId(att, "A"), memberId: member.id, eventId: evId, timestamp: new Date().toISOString(), memberName: member.name };
    setAttRef.current(prev => [...prev, newRec]);
    playSound("success");
    setScanStatus({ type: "success", member });
    setRecentCheckins(prev => [{ ...newRec, memberObj: member }, ...prev].slice(0, 8));
    setInput("");
    setTimeout(() => { setScanStatus(null); inputRef.current?.focus(); }, 2800);
  }, [playSound]);

  const startCamera = useCallback(async () => {
    setCamError(null);
    setCamState("loading");
    try {
      // iOS Safari requires a secure context (HTTPS) for camera access.
      const isSecure = window.isSecureContext || window.location.hostname === "localhost";
      if (!isSecure) {
        setCamState("error");
        const host = window.location.hostname || "your-ip";
        const port = window.location.port || "3000";
        const msg = `Camera needs HTTPS (not plain HTTP) when you open the app by Wi‑Fi IP. Install and open the TLOB AMS desktop app on this PC and use Remote access from there — it starts HTTPS for tablets automatically — then open https://${host}:${port} on this device. Developers can use: npm run start:lan:https`;
        setCamError(msg);
        showNotif?.(msg, "error");
        return;
      }
      if (!navigator?.mediaDevices?.getUserMedia) {
        setCamState("error");
        const msg = "Camera is not available in this browser.";
        setCamError(msg);
        showNotif?.(msg, "error");
        return;
      }

      // Preflight permission prompt for better iOS reliability, then immediately stop tracks.
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        try { stream.getTracks().forEach((t) => t.stop()); } catch {}
      } catch (e) {
        setCamState("error");
        const name = e?.name || "Error";
        const msg =
          name === "NotAllowedError"
            ? "Camera permission denied. On iPad: Settings → Safari → Camera → Allow, then refresh."
            : name === "NotFoundError"
              ? "No camera found on this device."
              : "Could not access camera. Please allow permission and refresh.";
        setCamError(msg);
        showNotif?.(msg, "error");
        return;
      }

      if (!libRef.current) libRef.current = new Promise((res, rej) => { if (window.Html5Qrcode) { res(); return; } const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js"; s.onload = res; s.onerror = () => { libRef.current = null; rej(); }; document.head.appendChild(s); });
      await libRef.current; await new Promise(r => setTimeout(r, 100));
      if (scannerRef.current) { try { await scannerRef.current.stop(); } catch {} scannerRef.current = null; }
      const sc = new window.Html5Qrcode("kiosk-qr-div", { verbose: false }); scannerRef.current = sc;
      try { await sc.start({ facingMode: { exact: "environment" } }, { fps: 12, qrbox: { width: 260, height: 260 } }, processScan, () => {}); }
      catch { await sc.start({ facingMode: "environment" }, { fps: 12, qrbox: { width: 260, height: 260 } }, processScan, () => {}); }
      setCamState("running");
    } catch (e) {
      setCamState("error");
      scannerRef.current = null;
      const msg = "Camera error. Please check permissions and ensure you're using HTTPS.";
      setCamError(msg);
      showNotif?.(msg, "error");
    }
  }, [processScan, showNotif]);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) { try { await scannerRef.current.stop(); } catch {} try { scannerRef.current.clear(); } catch {} scannerRef.current = null; }
    setCamState("idle");
    setCamError(null);
  }, []);

  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);
  useEffect(() => () => { if (scannerRef.current) { try { scannerRef.current.stop(); } catch {} } }, []);
  // prevent body scrolling while kiosk is active
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsNarrow(window.innerWidth <= 1100);
      setIsShort(window.innerHeight <= 760);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(document.fullscreenElement));
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document?.documentElement?.requestFullscreen) {
        showNotif?.("Fullscreen is not supported in this browser.", "error");
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      showNotif?.("Could not change fullscreen mode.", "error");
    }
  };

  const SC = { success: theme.success, duplicate: theme.warning, error: theme.danger };
  const SMSG = { success: "✓ Check-in Successful!", duplicate: "⚠ Already Checked In", error: "✗ Member Not Found" };
  const SICO = { success: "🎉", duplicate: "⚠️", error: "❌" };

  // carousel index for kiosk greeting
  const slides = useMemo(() => KIOSK_SLIDES || [], []);
  const [slideIdx, setSlideIdx] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), 4000);
    return () => clearInterval(id);
  }, [slides]);

  const shellPad = isNarrow ? 14 : 30;
  const headerPadY = isNarrow ? 12 : 16;
  const logoSize = isNarrow ? 48 : 64;
  const cameraHeight = isShort ? 220 : isNarrow ? 260 : 300;
  const sidePanelWidth = typeof window !== "undefined" && window.innerWidth <= 1280 ? 300 : 340;

  return (
    <div style={{ position: "absolute", inset: 0, background: theme.bg, display: "flex", flexDirection: "column", fontFamily: "'DM Sans',sans-serif", color: theme.text, overflow: "hidden" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes pop{0%{transform:scale(.85);opacity:0}60%{transform:scale(1.04)}100%{transform:scale(1);opacity:1}}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes scanGlow{0%,100%{box-shadow:0 0 0 0 rgba(var(--glow-color),0.7),inset 0 0 20px rgba(var(--glow-color),0.2)}50%{box-shadow:0 0 0 15px rgba(var(--glow-color),0),inset 0 0 30px rgba(var(--glow-color),0.3)}}input,select{font-family:inherit;}.btn{cursor:pointer;border:none;font-family:inherit;font-weight:600;transition:all .18s;}.btn:hover{filter:brightness(1.1);}.btn:active{transform:scale(.97);}}`}</style>

      {/* Header */}
      <div style={{ background: theme.surface, borderBottom: `1px solid ${theme.border}`, padding: `${headerPadY}px ${shellPad}px`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: isNarrow ? "wrap" : "nowrap", gap: isNarrow ? 10 : 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={CHURCH_LOGO_SRC} alt="Logo" style={{ width: logoSize, height: logoSize, objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: isNarrow ? 15 : 17, letterSpacing: "-.02em" }}>TLOB Attendance Management System</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>Kiosk Mode</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: isNarrow ? "flex-start" : "flex-end" }}>
          {activeEv && <div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 700 }}>{activeEv.name}</div><div style={{ fontSize: 11, color: theme.textMuted }}>{activeEv.date} • {activeEv.time}</div></div>}
          <div style={{ background: `${theme.accent}15`, borderRadius: 12, padding: "8px 16px", textAlign: "center", border: `1px solid ${theme.accent}30` }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.accent, lineHeight: 1 }}>{sessionCount}</div>
            <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Checked In</div>
          </div>
          <button
            className="btn"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Mute sound" : "Unmute sound"}
            style={{ background: theme.surface2, color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
          >
            {soundEnabled ? "🔊" : "🔇"} {soundEnabled ? "Sound" : "Muted"}
          </button>
          <button
            className="btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            style={{ background: theme.surface2, color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}
          >
            <Icon name={isFullscreen ? "fullscreenExit" : "fullscreen"} size={16} /> {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
          <button onClick={onExit} style={{ background: theme.surface2, color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✕ Exit Kiosk</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: isNarrow ? "1fr" : `1fr ${sidePanelWidth}px`, gridTemplateRows: isNarrow ? "auto 1fr" : undefined, overflow: "hidden" }}>
        {/* Main scan area */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: isNarrow ? "flex-start" : "center", padding: isNarrow ? 14 : 24, gap: 16, overflowY: isNarrow ? "auto" : "hidden" }}>
          {/* Status card */}
          {scanStatus ? (
            <div style={{ animation: "pop .35s ease", background: `${SC[scanStatus.type]}15`, border: `2px solid ${SC[scanStatus.type]}40`, borderRadius: 22, padding: isNarrow ? "20px 18px" : "28px 42px", textAlign: "center", width: "100%", maxWidth: isNarrow ? 720 : 500 }}>
              <div style={{ fontSize: 64, marginBottom: 10 }}>{SICO[scanStatus.type]}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: SC[scanStatus.type], marginBottom: 6 }}>{scanStatus.member?.name}</div>
              <div style={{ fontSize: 16, color: SC[scanStatus.type], fontWeight: 600 }}>{SMSG[scanStatus.type]}</div>
              {scanStatus.member?.ministry && scanStatus.type === "success" && <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 6 }}>{scanStatus.member.ministry}</div>}
            </div>
          ) : (
            <div style={{ background: theme.surface, border: `2px dashed ${theme.border}`, borderRadius: 22, padding: isNarrow ? "22px 18px" : "32px 42px", textAlign: "center", width: "100%", maxWidth: isNarrow ? 720 : 500 }}>
              {slides.length > 0 ? (
                <img src={slides[slideIdx]} alt="Greeting" style={{ maxWidth: 200, maxHeight: 120, marginBottom: 10, objectFit: "contain" }} />
              ) : (
                <div style={{ fontSize: 72, marginBottom: 10 }}>🎉</div>
              )}
              <div style={{ fontSize: isNarrow ? 20 : 22, fontWeight: 700, marginBottom: 6 }}>Welcome, TLOB Fam!</div>
              <div style={{ fontSize: 14, color: theme.textMuted }}>Scan your QR code or enter your Member ID</div>
              <div style={{ fontSize: 13, color: theme.textMuted }}>We're glad you're here!🙌</div>
            </div>
          )}

          {/* Event select */}
          <div style={{ width: "100%", maxWidth: 500 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, display: "block" }}>Active Event</label>
            <select value={selEv} onChange={e => setSelEv(e.target.value)} style={{ width: "100%", padding: "13px 16px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 12, color: theme.text, fontSize: 15, outline: "none", fontFamily: "inherit" }}>
              <option value="">— Select Event —</option>
              {events.filter(e => e.status === "Active" || e.status === "Upcoming").map(e => <option key={e.id} value={e.id}>{e.name} ({e.date})</option>)}
            </select>
          </div>

          {/* Camera view */}
          {camState !== "idle" && (
            <div style={{ width: "100%", maxWidth: isNarrow ? 720 : 500, marginTop: 16 }}>
              {camState === "loading" && <div style={{ textAlign: "center", padding: 20 }}><div style={{ width: 32, height: 32, border: `3px solid ${theme.border}`, borderTopColor: theme.accent, borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto 10px" }} /><div style={{ fontSize: 12, color: theme.textMuted }}>Starting camera…</div></div>}
              {camState === "error" && (
                <div style={{ textAlign: "center", padding: 16, color: theme.danger, background: `${theme.danger}10`, borderRadius: 12, border: `1px solid ${theme.danger}25` }}>
                  {camError || "Camera error. Please check permissions."}
                </div>
              )}
              <div 
                id="kiosk-qr-div" 
                style={{ 
                  width: "100%", 
                  height: cameraHeight, 
                  borderRadius: 14, 
                  overflow: "hidden", 
                  border: `3px solid ${theme.accent}`, 
                  display: camState === "error" ? "none" : "block", 
                  background: "#000",
                  animation: camState === "running" ? "scanGlow 2s ease-in-out infinite" : "none",
                  "--glow-color": theme.accent.replace("#", "").match(/.{1,2}/g).map(x => parseInt(x, 16)).join(", ")
                }} 
              />
              {camState === "running" && <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: theme.textMuted, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, animation: "fadeUp .4s ease" }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: theme.success, display: "inline-block", animation: "pulse 1.5s infinite" }} />Camera active</div>}
            </div>
          )}

          {/* Input row */}
          <div style={{ width: "100%", maxWidth: isNarrow ? 720 : 500, display: "flex", gap: 12, flexDirection: isNarrow ? "column" : "row" }}>
            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && processScan(input)} placeholder="Scan QR or type Member ID (e.g. M001)…"
              style={{ flex: 1, padding: "14px 16px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 12, color: theme.text, fontSize: 15, outline: "none", fontFamily: "inherit" }} />
            <button onClick={() => processScan(input)} disabled={!selEv || !input.trim()} style={{ background: theme.accent, color: "white", border: "none", borderRadius: 12, padding: isNarrow ? "12px 16px" : "0 24px", height: isNarrow ? 46 : 48, fontSize: 15, fontWeight: 700, cursor: (!selEv || !input.trim()) ? "not-allowed" : "pointer", opacity: (!selEv || !input.trim()) ? .45 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}>Check In</button>
          </div>

          {/* Camera controls */}
          <div style={{ display: "flex", gap: 12 }}>
            {camState === "idle" && <button onClick={startCamera} style={{ background: `${theme.accent2}15`, color: theme.accent2, border: `1px solid ${theme.accent2}30`, borderRadius: 12, padding: "11px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}><Icon name="camera" size={16} />📷 Camera Scanner</button>}
            {camState !== "idle" && <button onClick={stopCamera} style={{ background: `${theme.danger}15`, color: theme.danger, border: `1px solid ${theme.danger}25`, borderRadius: 12, padding: "11px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}><Icon name="close" size={16} />Stop Camera</button>}
          </div>

        </div>

        {/* Recent checkins panel */}
        <div style={{ background: theme.surface, borderLeft: isNarrow ? "none" : `1px solid ${theme.border}`, borderTop: isNarrow ? `1px solid ${theme.border}` : "none", padding: isNarrow ? 14 : 24, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          <div><div style={{ fontWeight: 800, fontSize: 18 }}>Recent Attendance</div><div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>This session</div></div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: isNarrow ? (isShort ? 220 : 280) : undefined }}>
            {recentCheckins.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: theme.textMuted, opacity: .5, paddingTop: 40 }}>
                <Icon name="scan" size={36} /><div style={{ fontSize: 12, textAlign: "center" }}>No check-ins yet.<br />Start scanning!</div>
              </div>
            ) : recentCheckins.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", background: i === 0 ? `${theme.accent}0d` : theme.surface2, borderRadius: 12, border: `1px solid ${i === 0 ? theme.accent + "30" : theme.border}`, animation: i === 0 ? "pop .3s ease" : undefined }}>
                <Avatar member={a.memberObj || { name: a.memberName }} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{a.memberName}</div>
                  <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{a.memberObj?.ministry || "Member"}</div>
                </div>
                {i === 0 && <div style={{ width: 9, height: 9, borderRadius: "50%", background: theme.success, boxShadow: `0 0 8px ${theme.success}` }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default KioskView;
