import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Icon } from "./Icon.jsx";
import Avatar from "./Avatar.jsx";
import { CHURCH_LOGO_SRC, KIOSK_SLIDES, usePersisted } from "../constants.js";
import { recordAuditLog } from "../auditLogs.js";
import { QRCode } from "../utils/qr.js";
import {
  applyVisitorConversion,
  buildClaimUrl,
  memberQrPayload,
  nextPrefixedId,
  shouldAutoConvertVisitor,
} from "../utils/convertVisitor.js";


// ─── KIOSK MODE ───────────────────────────────────────────────────────────────
function KioskView({ members, visitors, events, attendance, setAttendance, setMembers, setVisitors, setEvents, currentUser, completionPin, theme, onExit, showNotif, initialEvent }) {
  const [selEv, setSelEv] = useState(() => initialEvent || events.find(e => e.status === "Active")?.id || "");
  const [input, setInput] = useState("");
  const [scanStatus, setScanStatus] = useState(null); // null | {type,member}
  const [visitorForm, setVisitorForm] = useState({ name: "", contact: "", eventId: "", date: new Date().toISOString().split("T")[0], invitedBy: "", notes: "" });
  const [showVisitorForm, setShowVisitorForm] = useState(false);
  const [camState, setCamState] = useState("idle");
  const [camError, setCamError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // iPad 10th gen landscape is 1024px wide; treat it as "narrow" for a better fit.
  const [isNarrow, setIsNarrow] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 1100 : false));
  const [isShort, setIsShort] = useState(() => (typeof window !== "undefined" ? window.innerHeight <= 760 : false));
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRegisterQr, setShowRegisterQr] = useState(false);
  const [showMemberClaimQr, setShowMemberClaimQr] = useState(false);
  const [showMemberCardDirectory, setShowMemberCardDirectory] = useState(false);
  const [memberCardSearch, setMemberCardSearch] = useState("");
  const [selectedMemberClaim, setSelectedMemberClaim] = useState(null);
  const [showCompletionPin, setShowCompletionPin] = useState(false);
  const [completionPinInput, setCompletionPinInput] = useState("");
  const [completionPinError, setCompletionPinError] = useState("");
  const [completionSuccess, setCompletionSuccess] = useState(false);
  const inputRef = useRef(null);
  const completionPinRef = useRef(null);
  const scannerRef = useRef(null);
  const libRef = useRef(null);
  const membersRef = useRef(members); useEffect(() => { membersRef.current = members; }, [members]);
  const visitorsRef = useRef(visitors); useEffect(() => { visitorsRef.current = visitors || []; }, [visitors]);
  const attRef = useRef(attendance); useEffect(() => { attRef.current = attendance; }, [attendance]);
  const selEvRef = useRef(selEv); useEffect(() => { selEvRef.current = selEv; }, [selEv]);
  const setAttRef = useRef(setAttendance); useEffect(() => { setAttRef.current = setAttendance; }, [setAttendance]);
  const setMembersRef = useRef(setMembers); useEffect(() => { setMembersRef.current = setMembers; }, [setMembers]);
  const setVisitorsRef = useRef(setVisitors); useEffect(() => { setVisitorsRef.current = setVisitors; }, [setVisitors]);
  const statusRef = useRef(scanStatus); useEffect(() => { statusRef.current = scanStatus; }, [scanStatus]);
  const [publicRegisterEnabled] = usePersisted("public_register_enabled", true, currentUser?.id ?? null);
  const [publicRegisterBaseUrl] = usePersisted("public_register_base_url", "", currentUser?.id ?? null);
  const [autoConvertAfterVisits] = usePersisted("auto_convert_after_visits", 2, currentUser?.id ?? null);
  const autoConvertRef = useRef(autoConvertAfterVisits); useEffect(() => { autoConvertRef.current = autoConvertAfterVisits; }, [autoConvertAfterVisits]);
  const registerBaseUrlRef = useRef(publicRegisterBaseUrl); useEffect(() => { registerBaseUrlRef.current = publicRegisterBaseUrl; }, [publicRegisterBaseUrl]);
  const currentUserRef = useRef(currentUser); useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  const visitorRegisterUrl = useMemo(() => {
    const origin = String(publicRegisterBaseUrl || "").trim().replace(/\/$/, "");
    if (!origin || origin.startsWith("file:")) return "";
    const qs = selEv ? `?event=${encodeURIComponent(selEv)}` : "";
    return `${origin}${qs}`;
  }, [publicRegisterBaseUrl, selEv]);
  const activeEv = events.find(e => e.id === selEv);
  const availableMembers = useMemo(() => members.filter((member) => !member.archived), [members]);
  const filteredMemberCards = useMemo(() => {
    const query = memberCardSearch.trim().toLowerCase();
    if (!query) return availableMembers;
    return availableMembers.filter((member) => (
      String(member.name || "").toLowerCase().includes(query)
      || String(member.id || "").toLowerCase().includes(query)
    ));
  }, [availableMembers, memberCardSearch]);
  const sessionCount = attendance.filter(a => a.eventId === selEv).length;
  const recentCheckins = useMemo(() => attendance
    .filter(record => record.eventId === selEv)
    .slice()
    .sort((first, second) => new Date(second.timestamp).getTime() - new Date(first.timestamp).getTime())
    .map(record => ({
      ...record,
      memberObj: members.find(member => member.id === record.memberId)
        || visitors.find(visitor => visitor.id === record.visitorId)
        || { name: record.memberName },
    })), [attendance, members, visitors, selEv]);

  const nextId = (list, prefix) => nextPrefixedId(list, prefix);

  const dismissHold = useCallback(() => {
    setScanStatus(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const applyConversion = useCallback(async (visitor, membersSnap, attendanceSnap) => {
    const conversionRecord = attendanceSnap.find((record) => record.visitorId === visitor.id && record.eventId === selEvRef.current);
    const result = applyVisitorConversion(visitor, membersSnap, attendanceSnap, conversionRecord?.id);
    if (!result || !setMembersRef.current || !setVisitorsRef.current) return null;
    setMembersRef.current(result.members);
    setAttRef.current(result.attendance);
    setVisitorsRef.current((prev) => (prev || []).map((row) => (
      row.id === visitor.id ? { ...row, convertedToMember: true } : row
    )));
    membersRef.current = result.members;
    visitorsRef.current = (visitorsRef.current || []).map((row) => (
      row.id === visitor.id ? { ...row, convertedToMember: true } : row
    ));
    attRef.current = result.attendance;
    try {
      await recordAuditLog({
        actor: currentUserRef.current,
        action: "visitor_converted_to_member",
        target: result.member.id,
        source: "kiosk",
        metadata: { visitorId: visitor.id, memberId: result.member.id, name: visitor.name },
      });
    } catch {}
    return result.member;
  }, []);

  const showMemberCard = useCallback((member) => {
    const claimUrl = buildClaimUrl(registerBaseUrlRef.current, member);
    const scanPayload = memberQrPayload(member);
    setScanStatus({
      type: "success",
      hold: "member",
      member,
      claimUrl: String(claimUrl).startsWith("http") ? claimUrl : "",
      scanPayload,
    });
  }, []);

  const showVisitorCard = useCallback((visitor) => {
    setScanStatus({
      type: "success",
      hold: "visitor",
      member: visitor,
      visitorId: visitor.id,
    });
  }, []);

  // Play voice feedback for scan results
  const playSound = useCallback((type) => {
    if (!soundEnabled) return;
    try {
      // Cancel any previous speech
      window.speechSynthesis?.cancel();
      
      const utterance = new SpeechSynthesisUtterance();
      utterance.lang = 'American'; // American accent
      utterance.rate = 1.5; // Slightly faster
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      if (type === "success") {
        utterance.text = "Attendance recorded! Welcome, Impact Makers!";
        utterance.pitch = 8.1;
      } else if (type === "duplicate") {
        utterance.text = "Attendance already recorded.";
        utterance.pitch = 1.9;
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
    const selectedEvent = events.find((event) => event.id === evId);
    if (!selectedEvent || selectedEvent.status === "Completed") {
      showNotif?.("This event is already completed.", "warning");
      return;
    }
    const mems = membersRef.current, vsts = visitorsRef.current, att = attRef.current;
    let member = mems.find(m => val === `TLOB:${m.id}:${m.name}`) || mems.find(m => m.id === val.toUpperCase()) || mems.find(m => val.toUpperCase().includes(m.id));
    let visitor = vsts.find(v => v.id === val.toUpperCase()) || vsts.find(v => v.name.toLowerCase() === val.toLowerCase());
    if (!member && visitor?.convertedToMember) {
      member = mems.find(m => m.name === visitor.name) || null;
      visitor = member ? null : visitor;
    }
    if (!member && !visitor) {
      playSound("error");
      setScanStatus({ type: "error", member: { name: val } });
      setVisitorForm({ name: val.startsWith("TLOB:") ? "" : val, contact: "", eventId: evId, date: new Date().toISOString().split("T")[0], invitedBy: "", notes: "" });
      setTimeout(() => { setScanStatus(null); inputRef.current?.focus(); }, 2500);
      return;
    }
    if (member) {
      if (att.find(a => a.eventId === evId && a.memberId === member.id)) {
        playSound("duplicate");
        setScanStatus({ type: "duplicate", member });
        setTimeout(() => { setScanStatus(null); inputRef.current?.focus(); }, 2500);
        return;
      }
      const newRec = { id: nextId(att, "A"), memberId: member.id, visitorId: null, eventId: evId, timestamp: new Date().toISOString(), memberName: member.name };
      setAttRef.current(prev => [...prev, newRec]);
      attRef.current = [...att, newRec];
      playSound("success");
      setScanStatus({ type: "success", member });
      setInput("");
      setTimeout(() => { setScanStatus(null); inputRef.current?.focus(); }, 2800);
      return;
    }

    if (att.find(a => a.eventId === evId && a.visitorId === visitor.id)) {
      playSound("duplicate");
      setScanStatus({ type: "duplicate", member: visitor });
      setTimeout(() => { setScanStatus(null); inputRef.current?.focus(); }, 2500);
      return;
    }
    const newRec = { id: nextId(att, "A"), memberId: null, visitorId: visitor.id, eventId: evId, timestamp: new Date().toISOString(), memberName: visitor.name };
    const attendanceWithNew = [...att, newRec];
    setInput("");
    playSound("success");

    if (shouldAutoConvertVisitor({ visitor, attendance: attendanceWithNew, threshold: autoConvertRef.current })) {
      applyConversion(visitor, mems, attendanceWithNew).then((converted) => {
        if (converted) showMemberCard(converted);
        else {
          setAttRef.current(attendanceWithNew);
          attRef.current = attendanceWithNew;
          showVisitorCard(visitor);
        }
      });
      return;
    }

    setAttRef.current(attendanceWithNew);
    attRef.current = attendanceWithNew;
    showVisitorCard(visitor);
  }, [events, playSound, showNotif, applyConversion, showMemberCard, showVisitorCard]);

  const registerVisitor = () => {
    const name = visitorForm.name.trim();
    const evId = visitorForm.eventId || selEvRef.current;
    if (!name || !evId || !setVisitors) return;
    const visitorId = nextPrefixedId(visitors || [], "V");
    const attendanceId = nextPrefixedId(attendance, "A");
    const createdVisitor = {
      id: visitorId,
      name,
      contact: visitorForm.contact.trim(),
      eventId: evId,
      date: visitorForm.date,
      invitedBy: visitorForm.invitedBy,
      notes: visitorForm.notes.trim(),
      convertedToMember: false,
    };
    const newRecord = {
      id: attendanceId,
      memberId: null,
      visitorId,
      eventId: evId,
      timestamp: new Date().toISOString(),
      memberName: name,
    };
    const attendanceWithNew = [...attendance, newRecord];
    const visitorsWithNew = [...(visitors || []), createdVisitor];
    setShowVisitorForm(false);
    setVisitorForm({ name: "", contact: "", notes: "" });
    setInput("");
    playSound("success");

    if (shouldAutoConvertVisitor({ visitor: createdVisitor, attendance: attendanceWithNew, threshold: autoConvertRef.current })) {
      setVisitors(visitorsWithNew);
      visitorsRef.current = visitorsWithNew;
      applyConversion(createdVisitor, membersRef.current, attendanceWithNew).then((converted) => {
        if (converted) showMemberCard(converted);
        else {
          setAttendance(attendanceWithNew);
          attRef.current = attendanceWithNew;
          showVisitorCard(createdVisitor);
        }
      });
      return;
    }

    setVisitors(visitorsWithNew);
    setAttendance(attendanceWithNew);
    visitorsRef.current = visitorsWithNew;
    attRef.current = attendanceWithNew;
    showVisitorCard(createdVisitor);
  };

  const openCompletionPin = () => {
    if (!activeEv || activeEv.status === "Completed" || !setEvents) return;
    setCompletionPinInput("");
    setCompletionPinError("");
    setCompletionSuccess(false);
    setShowCompletionPin(true);
  };

  const closeCompletionPin = () => {
    setShowCompletionPin(false);
    setCompletionPinInput("");
    setCompletionPinError("");
    setCompletionSuccess(false);
    inputRef.current?.focus();
  };

  const completeSelectedEvent = async (event) => {
    event?.preventDefault();
    if (!activeEv || activeEv.status === "Completed" || !setEvents) return;
    if (!/^\d{6}$/.test(completionPinInput) || completionPinInput !== String(completionPin || "")) {
      setCompletionPinError("That PIN is incorrect. Please try again.");
      return;
    }

    setEvents((current) => current.map((event) => (
      event.id === activeEv.id ? { ...event, status: "Completed" } : event
    )));
    stopCamera();
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "event_completed",
        target: activeEv.id,
        source: "kiosk",
        metadata: { eventId: activeEv.id },
      });
    } catch {}
    setCompletionSuccess(true);
    showNotif?.(`${activeEv.name} marked as completed`);
  };

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
  useEffect(() => {
    if (!showCompletionPin) return undefined;
    completionPinRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !completionSuccess) closeCompletionPin();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showCompletionPin, completionSuccess]);
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
  const SMSG = { success: "✓ Attendance Recorded", duplicate: "⚠ Already Recorded", error: "✗ Member Not Found" };
  const SICO = { success: "🎉✅", duplicate: "⚠️", error: "❌" };

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
      <video
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, opacity: 0.92, pointerEvents: "none" }}
      >
        <source src={`${process.env.PUBLIC_URL || ""}/videobg.mp4`} type="video/mp4" />
      </video>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${theme.bg}70, ${theme.bg}35)`, zIndex: 1, pointerEvents: "none" }} />
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@keyframes pop{0%{transform:scale(.85);opacity:0}60%{transform:scale(1.04)}100%{transform:scale(1);opacity:1}}@keyframes pinModal{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes scanGlow{0%,100%{box-shadow:0 0 0 0 rgba(var(--glow-color),0.7),inset 0 0 20px rgba(var(--glow-color),0.2)}50%{box-shadow:0 0 0 15px rgba(var(--glow-color),0),inset 0 0 30px rgba(var(--glow-color),0.3)}}input,select{font-family:inherit;}.btn{cursor:pointer;border:none;font-family:inherit;font-weight:600;transition:all .18s;}.btn:hover{filter:brightness(1.1);}.btn:active{transform:scale(.97);}}`}</style>

      {/* Header */}
      <div style={{ position: "relative", zIndex: 2, background: `${theme.surface}ee`, borderBottom: `1px solid ${theme.border}`, padding: `${headerPadY}px ${shellPad}px`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: isNarrow ? "wrap" : "nowrap", gap: isNarrow ? 10 : 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img src={CHURCH_LOGO_SRC} alt="Logo" style={{ width: logoSize, height: logoSize, objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: isNarrow ? 15 : 22, letterSpacing: "-.02em" }}>TLOB Attendance Management System</div>
            <div style={{ fontSize: 15, color: theme.textMuted }}>Kiosk Mode</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: isNarrow ? "flex-start" : "flex-end" }}>
          {activeEv && <div style={{ textAlign: "right" }}><div style={{ fontSize: 14, fontWeight: 700 }}>{activeEv.name}</div><div style={{ fontSize: 11, color: theme.textMuted }}>{activeEv.date} • {activeEv.time}</div></div>}
          <div style={{ background: `${theme.accent}15`, borderRadius: 12, padding: "8px 16px", textAlign: "center", border: `1px solid ${theme.accent}30` }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: theme.accent, lineHeight: 1 }}>{sessionCount}</div>
            <div style={{ fontSize: 9, color: theme.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Attendance</div>
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
            <Icon name={isFullscreen ? "fullscreenExit" : "fullscreen"} size={16} /> {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
          <button onClick={onExit} style={{ background: theme.surface2, color: theme.textMuted, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>✕ Exit Kiosk</button>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 2, flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: isNarrow ? "1fr" : `1fr ${sidePanelWidth}px`, gridTemplateRows: isNarrow ? "auto 1fr" : undefined, overflow: "hidden" }}>
        {/* Main scan area */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: isNarrow ? "flex-start" : "center", padding: isNarrow ? 14 : 24, gap: 10, overflowY: (isNarrow || scanStatus?.hold) ? "auto" : "hidden" }}>
          {/* Status card */}
          {scanStatus ? (
            <div style={{ animation: "pop .35s ease", background: `${SC[scanStatus.type]}38`, border: `2px solid ${SC[scanStatus.type]}40`, borderRadius: 22, padding: isNarrow ? "20px 18px" : "28px 32px", textAlign: "center", width: "100%", maxWidth: isNarrow ? 720 : 520 }}>
              <div style={{ fontSize: scanStatus.hold ? 40 : 64, marginBottom: 10 }}>{scanStatus.hold === "member" ? "🎉" : SICO[scanStatus.type]}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: SC[scanStatus.type], marginBottom: 6 }}>{scanStatus.member?.name}</div>
              <div style={{ fontSize: 16, color: SC[scanStatus.type], fontWeight: 600 }}>
                {scanStatus.hold === "member" ? "You're now a member!" : scanStatus.hold === "visitor" ? "✓ Attendance Recorded" : SMSG[scanStatus.type]}
              </div>
              {scanStatus.member?.ministry && scanStatus.type === "success" && !scanStatus.hold && <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 6 }}>{scanStatus.member.ministry}</div>}
              {scanStatus.hold === "visitor" && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, letterSpacing: ".08em" }}>YOUR VISITOR ID</div>
                  <div style={{ marginTop: 4, fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 800, letterSpacing: ".08em" }}>{scanStatus.visitorId}</div>
                  <div style={{ display: "inline-block", marginTop: 12, padding: 10, background: "#fff", borderRadius: 12 }}>
                    <QRCode value={scanStatus.visitorId} size={180} />
                  </div>
                  <div style={{ marginTop: 10, fontSize: 13, color: theme.textMuted, lineHeight: 1.45 }}>Save or screenshot this QR. Scan it next time you attend.</div>
                  <button type="button" className="btn" onClick={dismissHold} style={{ marginTop: 14, background: theme.accent, color: "white", padding: "10px 20px", borderRadius: 10, fontSize: 14 }}>Continue</button>
                </div>
              )}
              {scanStatus.hold === "member" && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, letterSpacing: ".08em" }}>YOUR MEMBER ID</div>
                  <div style={{ marginTop: 4, fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 800, letterSpacing: ".08em" }}>{scanStatus.member?.id}</div>
                  <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
                    {scanStatus.claimUrl ? (
                      <div>
                        <div style={{ display: "inline-block", padding: 10, background: "#fff", borderRadius: 12 }}>
                          <QRCode value={scanStatus.claimUrl} size={188} />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: theme.textMuted, maxWidth: 320, marginLeft: "auto", marginRight: "auto", lineHeight: 1.4 }}>Scan with your phone to download your virtual member ID.</div>
                      </div>
                    ) : null}
                  </div>
                  <button type="button" className="btn" onClick={dismissHold} style={{ marginTop: 14, background: theme.accent, color: "white", padding: "10px 20px", borderRadius: 10, fontSize: 14 }}>Continue</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: theme.surface, border: `2px dashed ${theme.border}`, borderRadius: 22, padding: isNarrow ? "22px 18px" : "32px 42px", textAlign: "center", width: "100%", maxWidth: isNarrow ? 720 : 500 }}>
              {slides.length > 0 ? (
                <img src={slides[slideIdx]} alt="Greeting" style={{ maxWidth: 100, maxHeight: 120, marginBottom: 10, objectFit: "contain" }} />
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
            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && processScan(input)} placeholder="Scan QR or type Member/Visitor ID (e.g. M001)…"
              style={{ flex: 1, padding: "14px 16px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 12, color: theme.text, fontSize: 15, outline: "none", fontFamily: "inherit" }} />
            <button onClick={() => processScan(input)} disabled={!selEv || !input.trim()} style={{ background: theme.accent, color: "white", border: "none", borderRadius: 12, padding: isNarrow ? "12px 16px" : "0 24px", height: isNarrow ? 46 : 48, fontSize: 15, fontWeight: 700, cursor: (!selEv || !input.trim()) ? "not-allowed" : "pointer", opacity: (!selEv || !input.trim()) ? .45 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}>Check In</button>
          </div>

          {/* Camera controls */}
          <div style={{ display: "flex", gap: 12 }}>
            {camState === "idle" && <button onClick={startCamera} style={{ background: `${theme.accent2}15`, color: theme.accent2, border: `1px solid ${theme.accent2}30`, borderRadius: 12, padding: "11px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}><Icon name="camera" size={16} />📷 Camera Scanner</button>}
            {camState !== "idle" && <button onClick={stopCamera} style={{ background: `${theme.danger}15`, color: theme.danger, border: `1px solid ${theme.danger}25`, borderRadius: 12, padding: "11px 20px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}><Icon name="close" size={16} />Stop Camera</button>}
            {activeEv?.status === "Active" && <button onClick={openCompletionPin} style={{ background: `${theme.success}18`, color: theme.success, border: `1px solid ${theme.success}35`, borderRadius: 12, padding: "11px 20px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}><Icon name="check" size={16} />Complete Attendance</button>}
          </div>

        </div>

        {/* Recent checkins panel */}
        <div style={{ background: theme.surface, borderLeft: isNarrow ? "none" : `1px solid ${theme.border}`, borderTop: isNarrow ? `1px solid ${theme.border}` : "none", padding: isNarrow ? 14 : 24, display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          <div><div style={{ fontWeight: 800, fontSize: 18 }}>Recent Attendance</div><div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>{recentCheckins.length} recorded for this event</div></div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, maxHeight: isNarrow ? (isShort ? 220 : 280) : undefined }}>
            {recentCheckins.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: theme.textMuted, opacity: .5, paddingTop: 40 }}>
                <Icon name="scan" size={36} /><div style={{ fontSize: 12, textAlign: "center" }}>No check-ins yet.<br />Start scanning!</div>
              </div>
            ) : recentCheckins.map((a, i) => {
              const memberForClaim = a.memberId && a.memberObj && a.memberObj.id ? a.memberObj : null;
              const claimUrl = memberForClaim ? buildClaimUrl(registerBaseUrlRef.current, memberForClaim) : "";
              const hasClaimQr = Boolean(a.memberCardQr && memberForClaim && claimUrl && String(claimUrl).startsWith("http"));

              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 13px", background: i === 0 ? `${theme.accent}0d` : theme.surface2, borderRadius: 12, border: `1px solid ${i === 0 ? theme.accent + "30" : theme.border}`, animation: i === 0 ? "pop .3s ease" : undefined }}>
                  <Avatar member={a.memberObj || { name: a.memberName }} size={36} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{a.memberName}</div>
                    <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1 }}>{a.memberId || a.visitorId || "—"} • {new Date(a.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                  </div>
                  {hasClaimQr ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMemberClaim({ member: memberForClaim, url: claimUrl });
                        setShowMemberClaimQr(true);
                      }}
                      style={{
                        border: `1px solid ${theme.accent}33`,
                        background: `${theme.accent}12`,
                        color: theme.accent,
                        borderRadius: 8,
                        padding: "7px 10px",
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: ".05em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                      title={`Show QR for ${memberForClaim.name} to download their virtual member ID card`}
                    >
                      QR
                    </button>
                  ) : null}
                  {i === 0 && <div style={{ width: 9, height: 6, borderRadius: "50%", background: theme.success, boxShadow: `0 0 8px ${theme.success}` }} />}
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { setMemberCardSearch(""); setShowMemberCardDirectory(true); }}
            style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
          >
            <Icon name="qr" size={16} /> Member cards
          </button>
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{ position: "absolute", left: 0, right: isNarrow ? 0 : sidePanelWidth, bottom: 0, height: 70, zIndex: 3, background: `${theme.surface}ee`, borderTop: `1px solid ${theme.border}`, boxShadow: "0 -4px 14px rgba(0,0,0,.08)", pointerEvents: "none" }}
      />

      <div style={{ position: "fixed", left: 14, bottom: 14, zIndex: 12, display: "flex", gap: 8, flexWrap: "wrap", maxWidth: "calc(100% - 36px)" }}>
        <button
          onClick={() => {
            setScanStatus(null);
            setVisitorForm({ name: "", contact: "", eventId: selEv, date: new Date().toISOString().split("T")[0], invitedBy: "", notes: "" });
            setShowVisitorForm(true);
          }}
          style={{ background: theme.accent, color: "white", border: "none", borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: `0 6px 18px ${theme.accent}45`, display: "flex", alignItems: "center", gap: 7 }}
        >
          <Icon name="add" size={17} /> Register New Visitor / Member
        </button>
        {publicRegisterEnabled && (
          <button
            onClick={() => {
              if (!visitorRegisterUrl) {
                showNotif?.("Paste the visitor-register Vercel URL in Settings first.", "warning");
                return;
              }
              setShowRegisterQr(true);
            }}
            style={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 12, padding: "11px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 6px 18px rgba(0,0,0,.12)", display: "flex", alignItems: "center", gap: 7 }}
          >
            <Icon name="qr" size={19} /> Visitor QR
          </button>
        )}
      </div>

      {showRegisterQr && visitorRegisterUrl && (
        <div
          className="modal-overlay"
          onClick={() => setShowRegisterQr(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 26, width: "calc(100% - 32px)", maxWidth: 400, textAlign: "center", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Scan to self-register</h2>
              <button className="btn" onClick={() => setShowRegisterQr(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }} aria-label="Close"><Icon name="close" size={18} /></button>
            </div>
            <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.45, marginBottom: 16 }}>
              New visitors can scan this with their phone. {activeEv ? <>Pinned to <strong style={{ color: theme.text }}>{activeEv.name}</strong>.</> : "Select an event to pin the form."}
            </div>
            <div style={{ display: "inline-block", padding: 12, background: "#fff", borderRadius: 14, border: `1px solid ${theme.border}` }}>
              <QRCode value={visitorRegisterUrl} size={240} />
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: theme.textMuted, wordBreak: "break-all" }}>{visitorRegisterUrl}</div>
          </div>
        </div>
      )}

      {showMemberClaimQr && selectedMemberClaim && (
        <div
          className="modal-overlay"
          onClick={() => setShowMemberClaimQr(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 26, width: "calc(100% - 32px)", maxWidth: 360, textAlign: "center", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Member card QR</h2>
              <button className="btn" onClick={() => setShowMemberClaimQr(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }} aria-label="Close"><Icon name="close" size={18} /></button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>{selectedMemberClaim.member.name}</div>
            <div style={{ display: "inline-block", padding: 12, background: "#fff", borderRadius: 14, border: `1px solid ${theme.border}` }}>
              <QRCode value={selectedMemberClaim.url} size={220} />
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: theme.textMuted, lineHeight: 1.45 }}>Scan this to open the virtual member ID card and download it from the site.</div>
            <a href={selectedMemberClaim.url} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 14, background: theme.accent, color: "white", borderRadius: 10, padding: "10px 16px", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>Open link</a>
          </div>
        </div>
      )}

      {showMemberCardDirectory && (
        <div
          className="modal-overlay"
          onClick={() => setShowMemberCardDirectory(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 22, width: "calc(100% - 32px)", maxWidth: 420, maxHeight: "80vh", overflowY: "auto", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Member cards</h2>
              <button className="btn" onClick={() => setShowMemberCardDirectory(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }} aria-label="Close"><Icon name="close" size={18} /></button>
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>Choose a member to show their card QR for downloading.</div>
            <input
              type="search"
              value={memberCardSearch}
              onChange={(event) => setMemberCardSearch(event.target.value)}
              placeholder="Search member name or ID"
              aria-label="Search member name or ID"
              style={{ width: "100%", boxSizing: "border-box", padding: "10px 12px", marginBottom: 12, background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, outline: "none", fontFamily: "inherit" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredMemberCards.map((member) => {
                const claimUrl = buildClaimUrl(registerBaseUrlRef.current, member);
                const available = String(claimUrl).startsWith("http");
                return (
                  <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 10 }}>
                    <Avatar member={member} size={32} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</div>
                      <div style={{ fontSize: 11, color: theme.textMuted }}>{member.id}</div>
                    </div>
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => { setSelectedMemberClaim({ member, url: claimUrl }); setShowMemberCardDirectory(false); setShowMemberClaimQr(true); }}
                      style={{ border: `1px solid ${theme.accent}33`, background: `${theme.accent}12`, color: theme.accent, borderRadius: 8, padding: "7px 10px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", cursor: available ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: available ? 1 : .45 }}
                    >
                      QR
                    </button>
                  </div>
                );
              })}
              {filteredMemberCards.length === 0 && <div style={{ fontSize: 13, color: theme.textMuted, textAlign: "center", padding: 18 }}>{availableMembers.length === 0 ? "No members available." : "No matching members."}</div>}
            </div>
          </div>
        </div>
      )}

      {showVisitorForm && (
        <div className="modal-overlay" onClick={() => { setShowVisitorForm(false); setScanStatus(null); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="modal-box" onClick={(event) => event.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "calc(100% - 32px)", maxWidth: 460, color: theme.text, maxHeight: "90vh", overflowY: "auto", fontFamily: "'DM Sans', sans-serif", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Log New Visitor</h2>
              <button className="btn" onClick={() => { setShowVisitorForm(false); setScanStatus(null); }} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ color: theme.textMuted, fontSize: 12, marginBottom: 16 }}>Save this attendee and record today's attendance. You'll get a Visitor ID to use next time.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Full Name *</label><input type="text" autoFocus value={visitorForm.name} onChange={(event) => setVisitorForm((current) => ({ ...current, name: event.target.value }))} placeholder="Visitor name" style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} /></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Contact Number</label><input type="tel" value={visitorForm.contact} onChange={(event) => setVisitorForm((current) => ({ ...current, contact: event.target.value }))} placeholder="09XXXXXXXXX" style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Event</label><select value={visitorForm.eventId} onChange={(event) => setVisitorForm((current) => ({ ...current, eventId: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}><option value="">— Select —</option>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></div>
                <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Date</label><input type="date" value={visitorForm.date} onChange={(event) => setVisitorForm((current) => ({ ...current, date: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit" }} /></div>
              </div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Invited By (Member)</label><select value={visitorForm.invitedBy} onChange={(event) => setVisitorForm((current) => ({ ...current, invitedBy: event.target.value }))} style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit" }}><option value="">— Select Member —</option>{members.filter((member) => !member.archived).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
              <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: theme.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Notes</label><textarea value={visitorForm.notes} onChange={(event) => setVisitorForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Interests, remarks..." rows={2} style={{ width: "100%", boxSizing: "border-box", padding: "10px 13px", background: theme.surface2, border: `1.5px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, outline: "none", fontFamily: "inherit", resize: "vertical" }} /></div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 20, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => { setShowVisitorForm(false); setScanStatus(null); }} style={{ background: theme.surface2, color: theme.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Cancel</button>
              <button className="btn" onClick={registerVisitor} disabled={!visitorForm.name.trim() || !visitorForm.eventId} style={{ background: theme.accent, color: "white", padding: "8px 20px", borderRadius: 8, fontSize: 13, opacity: visitorForm.name.trim() && visitorForm.eventId ? 1 : .5 }}>Save & Check In</button>
            </div>
          </div>
        </div>
      )}

      {showCompletionPin && (
        <div
          role="presentation"
          onMouseDown={(event) => { if (!completionSuccess && event.target === event.currentTarget) closeCompletionPin(); }}
          style={{ position: "fixed", inset: 0, zIndex: 1100, display: "grid", placeItems: "center", padding: 20, background: "rgba(9, 16, 28, .66)", backdropFilter: "blur(7px)" }}
        >
          <form onSubmit={completeSelectedEvent} aria-modal="true" role="dialog" aria-labelledby="completion-pin-title" style={{ width: "min(100%, 430px)", background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 70px rgba(0, 0, 0, .32)", animation: "pinModal .22s ease-out" }}>
            {completionSuccess ? (
              <div style={{ padding: "32px 28px 28px", textAlign: "center" }}>
                <div style={{ width: 62, height: 62, display: "grid", placeItems: "center", margin: "0 auto 16px", borderRadius: "50%", background: `${theme.success}1c`, color: theme.success, boxShadow: `0 0 0 8px ${theme.success}0c` }}><Icon name="check" size={32} /></div>
                <div id="completion-pin-title" style={{ fontSize: 20, fontWeight: 800 }}>Attendance completed</div>
                <div style={{ margin: "8px auto 22px", maxWidth: 300, fontSize: 13, color: theme.textMuted, lineHeight: 1.5 }}><strong style={{ color: theme.text }}>{activeEv?.name}</strong> is now closed and ready for review.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button type="button" className="btn" onClick={() => onExit("events")} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, background: theme.accent, color: "white", border: "none", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Icon name="events" size={17} />View attendance</button>
                  <button type="button" className="btn" onClick={() => onExit()} style={{ width: "100%", padding: "11px 16px", borderRadius: 10, background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}`, fontSize: 14 }}>Close kiosk mode</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: "22px 24px 18px", background: `${theme.success}10`, borderBottom: `1px solid ${theme.success}24`, display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", flexShrink: 0, borderRadius: 12, background: `${theme.success}1c`, color: theme.success }}><Icon name="key" size={21} /></div>
                  <div style={{ flex: 1 }}>
                    <div id="completion-pin-title" style={{ fontSize: 18, fontWeight: 800 }}>Complete attendance</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: theme.textMuted, lineHeight: 1.45 }}>Enter the administrator PIN to close this event.</div>
                  </div>
                  <button type="button" className="btn" onClick={closeCompletionPin} aria-label="Cancel" style={{ background: "transparent", color: theme.textMuted, padding: 4, margin: -4 }}><Icon name="close" size={19} /></button>
                </div>
                <div style={{ padding: "20px 24px 24px" }}>
                  <div style={{ padding: "11px 13px", borderRadius: 10, background: theme.surface2, border: `1px solid ${theme.border}`, marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, textTransform: "uppercase", letterSpacing: ".05em" }}>Selected event</div>
                    <div style={{ marginTop: 3, fontSize: 14, fontWeight: 700 }}>{activeEv?.name}</div>
                  </div>
                  <label htmlFor="completion-pin" style={{ display: "block", marginBottom: 8, fontSize: 12, fontWeight: 700 }}>Six-digit PIN</label>
                  <input ref={completionPinRef} id="completion-pin" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={completionPinInput} onChange={(event) => { setCompletionPinInput(event.target.value.replace(/\D/g, "").slice(0, 6)); setCompletionPinError(""); }} aria-invalid={Boolean(completionPinError)} aria-describedby={completionPinError ? "completion-pin-error" : undefined} placeholder="000000" style={{ width: "100%", boxSizing: "border-box", padding: "13px 15px", background: theme.surface2, color: theme.text, border: `1.5px solid ${completionPinError ? theme.danger : theme.border}`, borderRadius: 10, outline: "none", fontFamily: "'DM Mono', monospace", fontSize: 20, fontWeight: 700, letterSpacing: ".3em", textAlign: "center" }} />
                  <div id="completion-pin-error" role="alert" style={{ minHeight: 18, marginTop: 7, fontSize: 12, color: theme.danger }}>{completionPinError}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                    <button type="button" className="btn" onClick={closeCompletionPin} style={{ padding: "10px 16px", borderRadius: 9, background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}`, fontSize: 13 }}>Cancel</button>
                    <button type="submit" className="btn" disabled={completionPinInput.length !== 6} style={{ padding: "10px 17px", borderRadius: 9, background: theme.success, color: "white", border: "none", fontSize: 13, opacity: completionPinInput.length === 6 ? 1 : .5, cursor: completionPinInput.length === 6 ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 7 }}><Icon name="check" size={16} />Complete event</button>
                  </div>
                </div>
              </>
            )}
          </form>
        </div>
      )}
    </div>
  );
}

export default KioskView;
