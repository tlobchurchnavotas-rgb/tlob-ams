import { useEffect, useMemo, useState } from "react";
import {
  usePersisted,
  useSupabaseTable,
  SEED_MEMBERS,
  SEED_EVENTS,
  SEED_ATTENDANCE,
  SEED_VISITORS,
  CHURCH_LOGO_SRC,
} from "./constants.js";
import { Icon } from "./components/Icon.jsx";
import HomePage from "./components/HomePage.jsx";
import LoginPage from "./components/LoginPage.jsx";
import KioskView from "./components/KioskView.jsx";
import DashboardView from "./components/DashboardView.jsx";
import MembersView from "./components/MembersView.jsx";
import MemberProfile from "./components/MemberProfile.jsx";
import EventsView from "./components/EventsView.jsx";
import ScannerView from "./components/ScannerView.jsx";
import ReportsView from "./components/ReportsView.jsx";
import AttendanceAnalyticsView from "./components/AttendanceAnalyticsView.jsx";
import MemberHistoryView from "./components/MemberHistoryView.jsx";
import VisitorsView from "./components/VisitorsView.jsx";
import CelebrationsView from "./components/CelebrationsView.jsx";
import RemoteAccessModal from "./components/RemoteAccessModal.jsx";
import AdminSettingsView from "./components/AdminSettingsView.jsx";
import AccountManagementView from "./components/AccountManagementView.jsx";
import AuditLogsView from "./components/AuditLogsView.jsx";
import { canAccessStaffFeatures, canManageAccounts } from "./roles.js";
import { isSupabaseConfigured, supabase } from "./supabaseClient.js";
import { getOrCreateProfile, getSession, onAuthStateChange, signInWithPassword, signOut } from "./auth.js";
import { migrateKvToRealTablesIfNeeded } from "./migrate.js";

// ─── WELCOME ───────────────────────────────────────────────────────────────────
// Welcome to TLOB AMS
// Date: April 14, 2026

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function TLOBApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showLoginPage, setShowLoginPage] = useState(false);
  const [activeView, setActiveView] = useState("dashboard");
  const [profileMember, setProfileMember] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const ownerId = currentUser?.id ?? null;
  const initialMembers = useMemo(() => (isSupabaseConfigured ? [] : SEED_MEMBERS), []);
  const initialEvents = useMemo(() => (isSupabaseConfigured ? [] : SEED_EVENTS), []);
  const initialAttendance = useMemo(() => (isSupabaseConfigured ? [] : SEED_ATTENDANCE), []);
  const initialVisitors = useMemo(() => (isSupabaseConfigured ? [] : SEED_VISITORS), []);

  const [members, setMembers, membersSync] = useSupabaseTable("members", initialMembers, ownerId);
  const [events, setEvents, eventsSync] = useSupabaseTable("events", initialEvents, ownerId);
  const [attendance, setAttendance, attendanceSync] = useSupabaseTable("attendance", initialAttendance, ownerId);
  const [visitors, setVisitors, visitorsSync] = useSupabaseTable("visitors", initialVisitors, ownerId);
  const [darkMode, setDarkMode] = usePersisted("darkMode", true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notification, setNotification] = useState(null);
  const [kioskMode, setKioskMode] = useState(false);
  const [kioskEvent, setKioskEvent] = useState("");
  const [remoteOpen, setRemoteOpen] = useState(false);

  const showNotif = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3200);
  };

  // Auto-clean orphaned attendance records (permanent fix for bug where records appear without scanning)
  useEffect(() => {
    if (attendance.length === 0 || events.length === 0) return;
    
    const validEventIds = new Set(events.map(e => e.id));
    const orphaned = attendance.filter(a => !validEventIds.has(a.eventId));
    
    if (orphaned.length > 0) {
      // Silently remove orphaned records
      const cleaned = attendance.filter(a => validEventIds.has(a.eventId));
      setAttendance(cleaned);
      // Log for debugging
      console.warn(`[Data Integrity] Removed ${orphaned.length} orphaned attendance record(s) with invalid eventIds`, orphaned);
    }
  }, [events, attendance, setAttendance]);

  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(document.fullscreenElement));
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document?.documentElement?.requestFullscreen) {
        showNotif("Fullscreen is not supported in this browser.", "error");
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      showNotif("Could not change fullscreen mode.", "error");
    }
  };

  useEffect(() => {
    // One-time cleanup: wipe all old localStorage state so the app starts fresh on the real DB.
    if (!isSupabaseConfigured) return;
    const flag = "tlob_local_cleared_v1";
    try {
      if (localStorage.getItem(flag) === "true") return;
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("tlob_")) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      localStorage.setItem(flag, "true");
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateAuth() {
      if (!isSupabaseConfigured || !supabase) {
        if (!cancelled) {
          setCurrentUser(null);
          setAuthReady(true);
        }
        return;
      }

      try {
        const session = await getSession();
        const user = session?.user ?? null;
        if (!user) {
          if (!cancelled) {
            setCurrentUser(null);
            setAuthReady(true);
          }
          return;
        }

        const profile = await getOrCreateProfile(user);
        try { await migrateKvToRealTablesIfNeeded(profile.id); } catch {}
        if (!cancelled) {
          setCurrentUser({
            id: profile.id,
            name: profile.name,
            role: profile.role || "Usher",
            username: profile.username || "",
            avatarUrl: profile.avatar_url || "",
            email: user.email,
          });
          setAuthReady(true);
        }
      } catch {
        if (!cancelled) {
          setCurrentUser(null);
          setAuthReady(true);
        }
      }
    }

    hydrateAuth();
    const sub = onAuthStateChange(async (session) => {
      if (!isSupabaseConfigured || !supabase) return;
      const user = session?.user ?? null;
      if (!user) {
        setCurrentUser(null);
        setAuthReady(true);
        return;
      }
      try {
        const profile = await getOrCreateProfile(user);
        try { await migrateKvToRealTablesIfNeeded(profile.id); } catch {}
        setCurrentUser({
          id: profile.id,
          name: profile.name,
          role: profile.role || "Usher",
          username: profile.username || "",
          avatarUrl: profile.avatar_url || "",
          email: user.email,
        });
        setAuthReady(true);
      } catch {
        setCurrentUser(null);
        setAuthReady(true);
      }
    });

    return () => {
      cancelled = true;
      try { sub?.unsubscribe?.(); } catch {}
    };
  }, []);

  const theme = {
    bg: darkMode ? "#080d18" : "#f0f4ff",
    surface: darkMode ? "#0f1623" : "#ffffff",
    surface2: darkMode ? "#161e2e" : "#f4f7ff",
    surface3: darkMode ? "#1c2540" : "#e8eeff",
    border: darkMode ? "#1e2d45" : "#dde3f0",
    text: darkMode ? "#e8eef8" : "#1a2340",
    textMuted: darkMode ? "#6b7fa3" : "#5a6a8a",
    accent: "#6366f1", accent2: "#06b6d4",
    accentGlow: darkMode ? "rgba(99,102,241,.18)" : "rgba(99,102,241,.1)",
    success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
  };

  const navItems = useMemo(() => ([
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "members", icon: "members", label: "Members" },
    { id: "events", icon: "events", label: "Events" },
    { id: "scanner", icon: "scan", label: "QR Scanner" },
    { id: "attendance", icon: "analytics", label: "Attendance" },
    { id: "visitors", icon: "profile", label: "Visitors" },
    { id: "celebrations", icon: "church", label: "Celebrations" },
    ...(canAccessStaffFeatures(currentUser?.role) ? [
      { id: "attendanceAnalytics", icon: "analytics", label: "Attendance Analytics" },
      { id: "memberHistory", icon: "profile", label: "Member History" },
    ] : []),
    ...(canManageAccounts(currentUser?.role) ? [
      { id: "accountManagement", icon: "key", label: "Account Management" },
      { id: "auditLogs", icon: "report", label: "Audit Logs" },
    ] : []),
    ...(canAccessStaffFeatures(currentUser?.role) ? [
      { id: "adminSettings", icon: "settings", label: "Settings" },
    ] : []),
  ]), [currentUser?.role]);

  const navSections = useMemo(() => {
    const byId = new Map(navItems.map((i) => [i.id, i]));
    const pick = (ids) => ids.map((id) => byId.get(id)).filter(Boolean);

    const main = pick(["dashboard"]);
    const management = pick(["members", "events", "scanner", "attendance", "visitors", "celebrations"]);
    const analytics = pick(["attendanceAnalytics", "memberHistory"]);
    const adminTools = pick(["accountManagement", "auditLogs", "adminSettings"]);

    return [
      { id: "main", label: "Main", items: main },
      { id: "management", label: "Management", items: management },
      ...(analytics.length ? [{ id: "analytics", label: "Analytics & Reports", items: analytics }] : []),
      ...(adminTools.length ? [{ id: "adminTools", label: "Admin Tools", items: adminTools }] : []),
    ].filter((s) => s.items.length);
  }, [navItems]);

  const syncUi = useMemo(() => {
    const statuses = [membersSync, eventsSync, attendanceSync, visitorsSync].filter(Boolean);
    const anyError = statuses.find((s) => s.state === "error");
    if (anyError) return { label: "Sync error", color: theme.danger, bg: `${theme.danger}15` };
    const anySaving = statuses.some((s) => s.state === "saving");
    if (anySaving) return { label: "Saving…", color: theme.warning, bg: `${theme.warning}15` };
    const anySaved = statuses.some((s) => s.state === "saved");
    if (anySaved) return { label: "Saved", color: theme.success, bg: `${theme.success}15` };
    return null;
  }, [membersSync, eventsSync, attendanceSync, visitorsSync, theme.danger, theme.success, theme.warning]);

  const onSignIn = useMemo(() => async (email, password) => {
    const session = await signInWithPassword(email, password);
    const user = session?.user ?? null;
    if (!user) throw new Error("No session");
    const profile = await getOrCreateProfile(user);
    setCurrentUser({
      id: profile.id,
      name: profile.name,
      role: profile.role || "Usher",
      username: profile.username || "",
      avatarUrl: profile.avatar_url || "",
      email: user.email,
    });
    setActiveView("dashboard");
  }, []);

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d1117", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans',sans-serif" }}>
        Loading…
      </div>
    );
  }

  if (!currentUser) {
    if (!showLoginPage) {
      return <HomePage onGetStarted={() => setShowLoginPage(true)} darkMode={false} />;
    }
    return <LoginPage onSignIn={onSignIn} darkMode={darkMode} supabaseConfigured={isSupabaseConfigured} onBack={() => setShowLoginPage(false)} />;
  }
  if (kioskMode) return (
    <KioskView
      members={members}
      events={events}
      attendance={attendance}
      setAttendance={setAttendance}
      theme={theme}
      onExit={async () => {
        try { await document.exitFullscreen?.(); } catch {}
        setKioskMode(false);
      }}
      showNotif={showNotif}
      initialEvent={kioskEvent}
    />
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: theme.bg, color: theme.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", overflow: "hidden", transition: "background .3s,color .3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${theme.border};border-radius:4px}
        input,select,textarea{font-family:inherit;}
        @keyframes slideIn{from{transform:translateX(24px);opacity:0}to{transform:translateX(0);opacity:1}}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes scanLine{0%{top:15%}50%{top:80%}100%{top:15%}}
        @keyframes glow{0%,100%{box-shadow:0 0 10px rgba(99,102,241,.3)}50%{box-shadow:0 0 22px rgba(99,102,241,.6)}}
        .nav-item{transition:all .2s;cursor:pointer;user-select:none;border-radius:10px;}
        aside[data-theme="light"] .nav-item{text-shadow:0 1px 2px rgba(0,0,0,.2);}
        aside[data-theme="light"] .nav-item:hover{background:rgba(255,255,255,.15);}
        aside[data-theme="dark"] .nav-item:hover{background:rgba(99,102,241,.15);}
        .nav-section{display:flex;align-items:center;gap:8px;margin:10px 6px 6px;}
        .nav-section .dot{width:6px;height:6px;border-radius:999px;opacity:.95;flex-shrink:0;}
        .nav-section .label{font-size:10px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;}
        aside[data-theme="light"] .nav-section .label{text-shadow:0 1px 2px rgba(0,0,0,.15);}
        .nav-section .line{flex:1;opacity:.8;margin-left:8px;}
        .nav-section-collapsed{opacity:.8;margin:10px 8px;}
        .btn{cursor:pointer;border:none;font-family:inherit;font-weight:600;transition:all .18s;}
        .btn:hover{filter:brightness(1.1);transform:translateY(-1px);}
        .btn:active{transform:scale(.97) translateY(0);}
        .card{animation:fadeUp .35s ease both;}
        .stat-card{transition:transform .2s,box-shadow .2s;}
        .stat-card:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.15);}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;animation:fadeUp .15s ease;}
        .modal-box{animation:slideUp .2s ease;}
        table{border-collapse:collapse;width:100%;}
        th,td{text-align:left;padding:11px 15px;border-bottom:1px solid ${theme.border};font-size:13px;}
        th{font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:${theme.textMuted};background:${theme.surface2};}
        tr:last-child td{border-bottom:none;}
        tr:hover td{background:${darkMode?"rgba(99,102,241,.04)":"rgba(99,102,241,.02)"};}
        .badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:.02em;}
        .tag-active{background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.2);}
        .tag-inactive{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.15);}
        .tag-completed{background:rgba(99,102,241,.12);color:#818cf8;border:1px solid rgba(99,102,241,.2);}
        .tag-upcoming{background:rgba(245,158,11,.1);color:#f59e0b;border:1px solid rgba(245,158,11,.15);}
        .tag-archived{background:rgba(148,163,184,.1);color:#94a3b8;}
        input[type=text],input[type=password],input[type=tel],input[type=date],input[type=time],input[type=email],select,textarea{width:100%;padding:10px 13px;background:${theme.surface2};border:1.5px solid ${theme.border};border-radius:10px;color:${theme.text};font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s;}
        input:focus,select:focus,textarea:focus{border-color:#6366f1 !important;box-shadow:0 0 0 3px rgba(99,102,241,.15);}
        label{display:block;font-size:11px;font-weight:700;color:${theme.textMuted};margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;}
      `}</style>

      {/* Sidebar */}
      <aside data-theme={darkMode ? "dark" : "light"} style={{ width: sidebarOpen ? 236 : 62, minWidth: sidebarOpen ? 236 : 62, background: darkMode ? "linear-gradient(180deg, #1f387c 0%, #192852 100%)" : "linear-gradient(180deg, #1e4caf 0%, #2890c9 100%)", borderRight: `1px solid ${darkMode ? theme.border : "rgba(255,255,255,.15)"}`, display: "flex", flexDirection: "column", transition: "width .22s cubic-bezier(.4,0,.2,1),min-width .22s", overflow: "hidden", zIndex: 10, boxShadow: darkMode ? "none" : "6px 0 30px rgba(79,70,229,.25)" }}>
        <div style={{ padding: "14px 12px", borderBottom: `1px solid ${darkMode ? theme.border : "rgba(255,255,255,.1)"}`, display: "flex", alignItems: "center", gap: 10, minHeight: 68 }}>
          <img src={CHURCH_LOGO_SRC} alt="TLOB Logo" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, objectFit: "cover", boxShadow: darkMode ? "0 2px 8px rgba(0,0,0,.2)" : "0 4px 16px rgba(255,255,255,.3)", border: darkMode ? `3px solid ${theme.border}` : `3px solid rgba(255,255,255,.25)` }} />
          {sidebarOpen && <div><div style={{ fontWeight: 800, fontSize: 12, letterSpacing: "-.02em", whiteSpace: "nowrap", color: darkMode ? theme.text : "#ffffff", lineHeight: 1.2, textShadow: darkMode ? "none" : "0 1px 3px rgba(0,0,0,.2)" }}>THE LORD OUR BANNER</div><div style={{ fontSize: 10, color: darkMode ? theme.textMuted : "rgba(255,255,255,.95)", textShadow: darkMode ? "none" : "0 1px 2px rgba(0,0,0,.15)" }}>Attendance Management System</div></div>}
        </div>
        <nav style={{ flex: 1, padding: "10px 9px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {navSections.map((section) => (
            <div key={section.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {sidebarOpen ? (
                <div className="nav-section">
                  <div className="dot" style={{background: darkMode ? theme.textMuted : "rgba(255,255,255,.8)"}} />
                  <div className="label" style={{color: darkMode ? theme.textMuted : "rgba(255,255,255,.7)"}}>{section.label}</div>
                  <div className="line" style={{background: darkMode ? theme.border : "rgba(255,255,255,.15)"}} />
                </div>
              ) : (
                <div className="nav-section-collapsed" style={{background: darkMode ? theme.border : "rgba(255,255,255,.15)"}} />
              )}

              {section.items.map((item) => (
                <div key={item.id} className="nav-item"
                  onClick={() => { setActiveView(item.id); setProfileMember(null); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", color: activeView === item.id ? (darkMode ? "#60a5fa" : "#ffffff") : (darkMode ? theme.text : "rgba(255,255,255,.95)"), background: activeView === item.id ? (darkMode ? `rgba(99,102,241,.15)` : "rgba(255,255,255,.2)") : undefined, position: "relative", borderRadius: "10px" }}>
                  {activeView === item.id && <div style={{ position: "absolute", left: 0, top: "18%", bottom: "18%", width: 3, background: darkMode ? "#60a5fa" : "#ffffff", borderRadius: "0 4px 4px 0" }} />}
                  <Icon name={item.icon} size={17} />
                  {sidebarOpen && <span style={{ fontSize: 13, fontWeight: activeView === item.id ? 700 : 500, whiteSpace: "nowrap" }}>{item.label}</span>}
                </div>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ padding: "10px 9px", borderTop: `1px solid ${darkMode ? theme.border : "rgba(255,255,255,.1)"}`, display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="nav-item" onClick={() => setDarkMode(!darkMode)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", color: darkMode ? theme.text : "rgba(255,255,255,.95)", borderRadius: "10px" }}>
            <Icon name={darkMode ? "sun" : "moon"} size={17} />
            {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 500 }}>{darkMode ? "Light Mode" : "Dark Mode"}</span>}
          </div>
          <div className="nav-item" onClick={() => { signOut(); setCurrentUser(null); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 11px", color: darkMode ? "#fca5a5" : "#fca5a5", borderRadius: "10px" }}>
            <Icon name="logout" size={17} />
            {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 600 }}>Sign Out</span>}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <header style={{ height: 62, background: theme.surface, borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", padding: "0 22px", gap: 14, flexShrink: 0 }}>
          <button className="btn" onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background: theme.surface2, color: theme.textMuted, padding: 8, borderRadius: 8, display: "flex" }}>
            <Icon name="menu" size={18} />
          </button>
          {profileMember && (
            <button className="btn" onClick={() => setProfileMember(null)} style={{ background: theme.surface2, color: theme.textMuted, padding: "6px 13px", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 6, border: `1px solid ${theme.border}` }}>
              <Icon name="back" size={14} /> Back
            </button>
          )}
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 18, fontWeight: 1000, letterSpacing: "-.02em", color: theme.text }}>
              {profileMember ? "Member Profile" : { dashboard: "Dashboard", members: "Members", events: "Events", scanner: "QR Scanner", attendance: "Attendance Reports", attendanceAnalytics: "Attendance Analytics", memberHistory: "Member Attendance History", accountManagement: "Account Management", auditLogs: "Audit Logs", usermgmt: "User Management", visitors: "Visitor Tracking", celebrations: "Celebrations", adminSettings: "Settings" }[activeView]}
            </h1>
            <div style={{ fontSize: 11, fontWeight: 500, color: theme.textMuted, marginTop: 1 }}>
              Welcome to TLOB AMS • {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          {syncUi && (
            <div style={{ fontSize: 11, fontWeight: 800, padding: "6px 10px", borderRadius: 999, background: syncUi.bg, color: syncUi.color, border: `1px solid ${theme.border}` }}>
              {syncUi.label}
            </div>
          )}
          <button
            className="btn"
            onClick={() => setRemoteOpen(true)}
            title="Remote access (iPad / phone)"
            style={{
              background: theme.surface2,
              color: theme.textMuted,
              padding: "8px 12px",
              borderRadius: 9,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: `1px solid ${theme.border}`,
              whiteSpace: "nowrap",
            }}
          >
            <Icon name="qr" size={16} /> Remote Connection
          </button>
          <button
            className="btn"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            style={{
              background: theme.surface2,
              color: theme.textMuted,
              padding: "8px 12px",
              borderRadius: 9,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: `1px solid ${theme.border}`,
              whiteSpace: "nowrap",
            }}
          >
            <Icon name={isFullscreen ? "fullscreenExit" : "fullscreen"} size={16} /> {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 9, padding: "6px 12px" }}>
            {currentUser.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt="Profile"
                style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: `1px solid ${theme.border}` }}
              />
            ) : (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "white" }}>{currentUser.name[0]}</div>
            )}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.text, lineHeight: 1.2 }}>{currentUser.name}</div>
              <div style={{ fontSize: 10, color: theme.accent, fontWeight: 600 }}>{currentUser.role}</div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: "auto", padding: 22, background: theme.bg }}>
          {profileMember
            ? <MemberProfile member={profileMember} members={members} attendance={attendance} events={events} theme={theme} onClose={() => setProfileMember(null)} showNotif={showNotif} />
            : activeView === "dashboard" ? <DashboardView members={members} events={events} attendance={attendance} theme={theme} />
            : activeView === "members" ? <MembersView members={members} setMembers={setMembers} events={events} theme={theme} showNotif={showNotif} currentUser={currentUser} onViewProfile={setProfileMember} />
            : activeView === "events" ? <EventsView events={events} setEvents={setEvents} attendance={attendance} setAttendance={setAttendance} members={members} theme={theme} showNotif={showNotif} currentUser={currentUser} />
            : activeView === "scanner" ? <ScannerView members={members} events={events} attendance={attendance} setAttendance={setAttendance} theme={theme} showNotif={showNotif} currentUser={currentUser} onLaunchKiosk={async (evId) => {
              // Best-effort: request fullscreen on the user gesture that launches kiosk mode.
              try { await document.documentElement.requestFullscreen?.(); } catch {}
              setKioskEvent(evId);
              setKioskMode(true);
            }} />
            : activeView === "attendance" ? <ReportsView attendance={attendance} members={members} events={events} theme={theme} showNotif={showNotif} />
            : activeView === "attendanceAnalytics" ? <AttendanceAnalyticsView attendance={attendance} members={members} events={events} theme={theme} />
            : activeView === "memberHistory" ? <MemberHistoryView attendance={attendance} members={members} events={events} theme={theme} showNotif={showNotif} />
            : activeView === "visitors" ? <VisitorsView visitors={visitors} setVisitors={setVisitors} members={members} setMembers={setMembers} events={events} theme={theme} showNotif={showNotif} currentUser={currentUser} />
            : activeView === "celebrations" ? <CelebrationsView members={members} theme={theme} />
            : activeView === "accountManagement" ? (
                canManageAccounts(currentUser?.role) ? (
                  <AccountManagementView theme={theme} showNotif={showNotif} currentUser={currentUser} setCurrentUser={setCurrentUser} />
                ) : (
                  <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 22, maxWidth: 480 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Access restricted</div>
                    <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.5 }}>Account Management is available to Admin and Pastor only.</div>
                  </div>
                )
              )
            : activeView === "auditLogs" ? (
                canManageAccounts(currentUser?.role) ? (
                  <AuditLogsView theme={theme} showNotif={showNotif} />
                ) : (
                  <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 22, maxWidth: 480 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Access restricted</div>
                    <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.5 }}>Audit Logs is available to Admin and Pastor only.</div>
                  </div>
                )
              )
            : activeView === "adminSettings" ? <AdminSettingsView theme={theme} showNotif={showNotif} currentUser={currentUser} setCurrentUser={setCurrentUser} />
            : null}
        </main>
      </div>

      {notification && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: notification.type === "success" ? theme.success : notification.type === "error" ? theme.danger : theme.warning, color: "white", padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 9, boxShadow: "0 8px 28px rgba(0,0,0,.4)", animation: "slideIn .25s ease", zIndex: 2000 }}>
          <Icon name={notification.type === "success" ? "check" : "close"} size={15} /> {notification.msg}
        </div>
      )}

      {remoteOpen && (
        <RemoteAccessModal theme={theme} onClose={() => setRemoteOpen(false)} />
      )}
    </div>
  );
}
