import { CHURCH_LOGO_SRC } from "../constants.js";

function Pill({ children, bg, color, border }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 999,
        background: bg,
        color,
        border,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Dot({ c }) {
  return <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: c, display: "inline-block" }} />;
}

const HomePage = ({ onGetStarted, darkMode = false }) => {
  const light = {
    pageBg: "#070a12",
    pageBg2: "#070a12",
    text: "#0b1220",
    textMuted: "rgba(11, 18, 32, 0.68)",
    surface: "rgba(255, 255, 255, 0.78)",
    surface2: "rgba(255, 255, 255, 0.92)",
    stroke: "rgba(15, 23, 42, 0.10)",
    stroke2: "rgba(15, 23, 42, 0.14)",
    softShadow: "0 1px 2px rgba(0,0,0,.05), 0 20px 60px rgba(2, 6, 23, .12)",
    softShadowHover: "0 2px 10px rgba(0,0,0,.07), 0 28px 90px rgba(37, 99, 235, .16)",
    accent: "#2563eb",
    accent2: "#06b6d4",
    accent3: "#a855f7",
    glowA: "rgba(37, 99, 235, 0.28)",
    glowB: "rgba(6, 182, 212, 0.18)",
    glowC: "rgba(168, 85, 247, 0.16)",
    heroBg: "#f7f9ff",
    heroText: "#0b1220",
    heroMuted: "rgba(11, 18, 32, 0.70)",
    footerBg: "#fbfcff",
  };

  const dark = {
    pageBg: "#050713",
    pageBg2: "#050713",
    text: "#eaf1ff",
    textMuted: "rgba(234, 241, 255, 0.72)",
    surface: "rgba(10, 14, 26, 0.72)",
    surface2: "rgba(15, 23, 42, 0.80)",
    stroke: "rgba(148, 163, 184, 0.16)",
    stroke2: "rgba(148, 163, 184, 0.22)",
    softShadow: "0 1px 2px rgba(0,0,0,.25), 0 24px 80px rgba(0, 0, 0, .45)",
    softShadowHover: "0 4px 14px rgba(0,0,0,.30), 0 34px 100px rgba(59, 130, 246, .18)",
    accent: "#60a5fa",
    accent2: "#22d3ee",
    accent3: "#c084fc",
    glowA: "rgba(96, 165, 250, 0.22)",
    glowB: "rgba(34, 211, 238, 0.14)",
    glowC: "rgba(192, 132, 252, 0.14)",
    heroBg: "#050713",
    heroText: "#eaf1ff",
    heroMuted: "rgba(234, 241, 255, 0.70)",
    footerBg: "#070a18",
  };

  const t = darkMode ? dark : light;

  const features = [
    {
      title: "Member Management",
      desc: "Smart profiles, quick search, and clean organization for your community.",
      icon: "🎯",
      accent: t.accent,
    },
    {
      title: "Attendance Analytics",
      desc: "Spot trends instantly with weekly/monthly insights and engagement signals.",
      icon: "📊",
      accent: t.accent3,
    },
    {
      title: "Event Planning",
      desc: "Create events, track turnout, and keep everything in sync—effortlessly.",
      icon: "🎤",
      accent: t.accent2,
    },
    {
      title: "QR Scanning",
      desc: "Fast attendance scanning that feel modern. Built for speed at the entrance.",
      icon: "🎫",
      accent: t.accent,
    },
    {
      title: "Kiosk Mode",
      desc: "Launch a full-screen check-in experience for services and conferences.",
      icon: "🧾",
      accent: t.accent2,  
    },
    {
      title: "Privacy & Control",
      desc: "Role-based access, audit-ready actions, and safer operations by design.",
      icon: "🛡️",
      accent: t.accent3,
    },
  ];

  const steps = [
    { k: "01", title: "Sign in", desc: "Access your dashboard securely from any device." },
    { k: "02", title: "Create an event", desc: "Set up service or program events in seconds." },
    { k: "03", title: "Check in fast", desc: "Scan QR codes or use kiosk mode at the door." },
    { k: "04", title: "See insights", desc: "Understand attendance and engagement at a glance." },
  ];

  const stats = [
    { label: "Faster check-ins", value: "3×" },
    { label: "Fewer errors", value: "↓ 60%" },
    { label: "Engagement clarity", value: "Weekly" },
  ];

  const Year = new Date().getFullYear();

  const gradText = `linear-gradient(120deg, ${t.accent} 0%, ${t.accent2} 45%, ${t.accent3} 100%)`;
  const primaryBtnBg = `linear-gradient(120deg, ${t.accent} 0%, ${t.accent2} 45%, ${t.accent3} 100%)`;

  return (
    <div
      style={{
        minHeight: "100vh",
        fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
        color: t.heroText,
        background: t.heroBg,
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        a { color: inherit; text-decoration: none; }
        @keyframes floaty { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-10px,0); } }
        @keyframes shimmer { 0% { transform: translateX(-40%); opacity: .0; } 15% { opacity: .55 } 50% { opacity: .25; } 100% { transform: translateX(120%); opacity: 0; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        }
        .hp-container { max-width: 1580px; margin: 0 auto; padding: 0 28px; }
        .hp-grid-hero { display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 26px; align-items: center; }
        .hp-grid-features { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .hp-grid-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .hp-grid-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 1024px) {
          .hp-grid-hero { grid-template-columns: 1fr; }
          .hp-grid-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 680px) {
          .hp-grid-features { grid-template-columns: 1fr; }
          .hp-grid-steps { grid-template-columns: 1fr; }
          .hp-grid-stats { grid-template-columns: 1fr; }
          .hp-container { padding: 0 18px; }
        }
        .hp-btn { cursor: pointer; border: none; font-family: inherit; transition: transform .18s ease, filter .18s ease, box-shadow .18s ease; }
        .hp-btn:active { transform: scale(.985); }
      `}</style>

      {/* Animated mesh background */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          background: darkMode
            ? `
              radial-gradient(900px 540px at 15% 10%, ${t.glowA}, transparent 55%),
              radial-gradient(760px 520px at 90% 0%, ${t.glowC}, transparent 60%),
              radial-gradient(900px 580px at 85% 90%, ${t.glowB}, transparent 60%),
              radial-gradient(720px 520px at 0% 100%, rgba(15,23,42,.65), transparent 60%)
            `
            : `
              radial-gradient(900px 560px at 15% 5%, ${t.glowA}, transparent 60%),
              radial-gradient(760px 520px at 100% 10%, ${t.glowC}, transparent 62%),
              radial-gradient(900px 560px at 85% 95%, ${t.glowB}, transparent 62%),
              radial-gradient(720px 520px at 0% 100%, rgba(255,255,255,.95), transparent 60%)
            `,
          opacity: darkMode ? 1 : 0.95,
          filter: "saturate(1.15)",
        }}
      />

      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          borderBottom: `1px solid ${t.stroke}`,
          background: t.surface,
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div
          className="hp-container"
          style={{
            height: 74,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {CHURCH_LOGO_SRC ? (
              <img
                src={CHURCH_LOGO_SRC}
                alt=""
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  objectFit: "cover",
                  border: `1px solid ${t.stroke2}`,
                  boxShadow: darkMode ? "0 10px 24px rgba(0,0,0,.35)" : "0 10px 24px rgba(2,6,23,.10)",
                }}
              />
            ) : (
              <div
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: gradText,
                  boxShadow: darkMode ? "0 10px 24px rgba(0,0,0,.35)" : "0 10px 24px rgba(2,6,23,.10)",
                }}
              />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                TLOB AMS
              </div>
              <div style={{ fontSize: 11, color: t.heroMuted, fontWeight: 650, marginTop: 2 }}>
                Attendance Management System
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pill bg={darkMode ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.05)"} color={t.heroMuted} border={`1px solid ${t.stroke}`}>
              <Dot c={t.accent2} /> Live dashboard
            </Pill>
            <button
              type="button"
              className="hp-btn"
              onClick={onGetStarted}
              style={{
                padding: "10px 18px",
                borderRadius: 999,
                color: "#fff",
                background: primaryBtnBg,
                fontSize: 13,
                fontWeight: 750,
                boxShadow: darkMode ? "0 14px 40px rgba(59,130,246,.22)" : "0 14px 40px rgba(37,99,235,.20)",
                border: `1px solid ${darkMode ? "rgba(255,255,255,.08)" : "rgba(15,23,42,.06)"}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.filter = "brightness(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.filter = "none";
              }}
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 1 }}>
        {/* Hero */}
        <section style={{ padding: "56px 0 18px" }}>
          <div className="hp-container">
            <div className="hp-grid-hero">
              <div style={{ animation: "fadeUp .55s ease both" }}>
                <Pill bg={darkMode ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.05)"} color={t.heroMuted} border={`1px solid ${t.stroke}`}>
                  <Dot c={t.accent} /> Welcome to
                </Pill>

                <h1
                  style={{
                    marginTop: 16,
                    fontSize: "50px",
                    lineHeight: 1.02,
                    letterSpacing: "-0.04em",
                    fontWeight: 950,
                    color: t.heroText,
                  }}
                >
                  TLOB Ushering Ministry
                  <br />
                  <span
                    style={{
                      background: gradText,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      fontSize: "50px",
                      maxWidth: 860,
                      marginLeft: "auto",
                      marginRight: "auto",
                    }}
                  >
                    Attendance Management System
                  </span>
                </h1>

                <p
                  style={{
                    marginTop: 14,
                    fontSize: 16,
                    lineHeight: 1.7,
                    maxWidth: 560,
                    color: t.heroMuted,
                    fontWeight: 550,
                  }}
                >
                  TLOB AMS brings attendance, events, and member engagement into one polished platform—designed for fast entrance
                  flow.
                </p>

                <div style={{ marginTop: 22, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="hp-btn"
                    onClick={onGetStarted}
                    style={{
                      padding: "14px 18px",
                      borderRadius: 14,
                      color: "#fff",
                      background: primaryBtnBg,
                      fontSize: 14,
                      fontWeight: 800,
                      letterSpacing: "-0.01em",
                      boxShadow: darkMode ? "0 18px 60px rgba(59,130,246,.26)" : "0 18px 60px rgba(37,99,235,.22)",
                      border: `1px solid ${darkMode ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)"}`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.filter = "brightness(1.05)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.filter = "none";
                    }}
                  >
                    Get Started <span aria-hidden style={{ fontSize: 16 }}>→</span>
                  </button>

                  <Pill bg={darkMode ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.70)"} color={t.heroMuted} border={`1px solid ${t.stroke}`}>
                    <Dot c={t.accent3} /> QR-ready • Kiosk mode • Reports
                  </Pill>
                </div>

                <div style={{ marginTop: 18 }} className="hp-grid-stats">
                  {stats.map((s) => (
                    <div
                      key={s.label}
                      style={{
                        padding: "12px 14px",
                        borderRadius: 16,
                        border: `1px solid ${t.stroke}`,
                        background: t.surface2,
                        boxShadow: t.softShadow,
                      }}
                    >
                      <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: "-0.03em" }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: t.heroMuted, marginTop: 2, fontWeight: 650 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product preview */}
              <div style={{ animation: "fadeUp .55s ease .08s both" }}>
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    maxWidth: 650,
                    marginLeft: "auto",
                    marginRight: "auto",
                    borderRadius: 22,
                    border: `1px solid ${t.stroke}`,
                    background: darkMode
                      ? "linear-gradient(180deg, rgba(15,23,42,.82) 0%, rgba(10,14,26,.82) 100%)"
                      : "linear-gradient(180deg, rgba(255,255,255,.95) 0%, rgba(248,250,255,.92) 100%)",
                    boxShadow: darkMode ? t.softShadow : t.softShadowHover,
                    overflow: "hidden",
                    minHeight: 420,
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: -1,
                      background: `
                        radial-gradient(800px 400px at 15% 15%, ${t.glowA}, transparent 55%),
                        radial-gradient(700px 420px at 85% 35%, ${t.glowC}, transparent 60%),
                        radial-gradient(700px 420px at 55% 100%, ${t.glowB}, transparent 62%)
                      `,
                      opacity: darkMode ? 0.8 : 0.9,
                    }}
                  />

                  <div style={{ position: "relative", padding: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span aria-hidden style={{ display: "flex", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(239,68,68,.85)" }} />
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(245,158,11,.85)" }} />
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: "rgba(16,185,129,.85)" }} />
                        </span>
                        <div style={{ fontSize: 12, color: t.heroMuted, fontWeight: 750 }}>Dashboard preview</div>
                      </div>
                      <Pill bg={darkMode ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.72)"} color={t.heroMuted} border={`1px solid ${t.stroke}`}>
                        <Dot c={t.accent2} /> Synced
                      </Pill>
                    </div>

                    <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      {[
                        { label: "Today check-ins", value: "128", c: t.accent },
                        { label: "Active event", value: "Sunday Service", c: t.accent2 },
                        { label: "New visitors", value: "12", c: t.accent3 },
                        { label: "On-time rate", value: "92%", c: t.accent },
                      ].map((card) => (
                        <div
                          key={card.label}
                          style={{
                            borderRadius: 18,
                            border: `1px solid ${t.stroke}`,
                            background: darkMode ? "rgba(10,14,26,.62)" : "rgba(255,255,255,.78)",
                            padding: "14px 14px",
                            boxShadow: "0 10px 28px rgba(2,6,23,.08)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontSize: 12, color: t.heroMuted, fontWeight: 700 }}>{card.label}</div>
                            <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: card.c, opacity: 0.95 }} />
                          </div>
                          <div style={{ marginTop: 8, fontSize: 18, fontWeight: 950, letterSpacing: "-0.03em" }}>{card.value}</div>
                        </div>
                      ))}
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        borderRadius: 18,
                        border: `1px solid ${t.stroke}`,
                        background: darkMode ? "rgba(10,14,26,.62)" : "rgba(255,255,255,.78)",
                        padding: "14px 14px",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          position: "absolute",
                          top: 0,
                          bottom: 0,
                          left: -120,
                          width: 220,
                          background: `linear-gradient(90deg, transparent, ${darkMode ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.55)"}, transparent)`,
                          transform: "skewX(-20deg)",
                          animation: "shimmer 4.2s ease-in-out infinite",
                        }}
                      />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                        <div style={{ fontSize: 12, color: t.heroMuted, fontWeight: 800 }}>Weekly attendance</div>
                        <div style={{ fontSize: 12, fontWeight: 900, color: t.heroText }}>+14%</div>
                      </div>
                      <div style={{ marginTop: 12, display: "flex", alignItems: "flex-end", gap: 8, height: 72 }}>
                        {[28, 44, 38, 62, 54, 70, 66].map((h, idx) => (
                          <div
                            key={idx}
                            style={{
                              flex: 1,
                              height: h,
                              borderRadius: 10,
                              background: `linear-gradient(180deg, ${t.accent} 0%, ${t.accent2} 60%, ${t.accent3} 100%)`,
                              opacity: 0.92,
                              boxShadow: "0 8px 18px rgba(37,99,235,.14)",
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      right: -26,
                      bottom: -26,
                      width: 140,
                      height: 140,
                      borderRadius: 999,
                      background: `radial-gradient(circle at 30% 30%, ${t.accent2}, transparent 65%)`,
                      filter: "blur(2px)",
                      opacity: darkMode ? 0.6 : 0.55,
                      animation: "floaty 6.5s ease-in-out infinite",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{ padding: "34px 0 16px" }}>
          <div className="hp-container">
            <div style={{ textAlign: "center", marginBottom: 16, animation: "fadeUp .55s ease .10s both" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 900,
                  lineHeight: 1.2,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: t.heroMuted,
                }}
              >
                Built for entrance flow
              </div>
              <h2 style={{ fontSize: "clamp(22px, 3.2vw, 34px)", fontWeight: 950, letterSpacing: "-0.03em", marginTop: 10 }}>
                Better user interface design, practical features
              </h2>
            </div>

            <div className="hp-grid-features">
              {features.map((f, idx) => (
                <div
                  key={f.title}
                  style={{
                    borderRadius: 18,
                    border: `1px solid ${t.stroke}`,
                    background: t.surface2,
                    boxShadow: t.softShadow,
                    padding: "16px 16px 14px",
   
                    position: "relative",
                    overflow: "hidden",
                    transition: "transform .20s ease, box-shadow .20s ease, border-color .20s ease",
                    animation: `fadeUp .55s ease ${0.05 + idx * 0.06}s both`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = t.softShadowHover;
                    e.currentTarget.style.borderColor = darkMode ? "rgba(96,165,250,.25)" : "rgba(37,99,235,.18)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = t.softShadow;
                    e.currentTarget.style.borderColor = t.stroke;
                  }}
                >
                  <div
                    aria-hidden
                    style={{
                      position: "absolute",
                      inset: -1,
                      background: `radial-gradient(560px 260px at 20% 10%, ${f.accent}22, transparent 60%)`,
                      opacity: darkMode ? 0.55 : 0.62,
                    }}
                  />

                  <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      aria-hidden
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        background: `linear-gradient(135deg, ${f.accent} 0%, ${t.accent2} 55%, ${t.accent3} 100%)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 20,
                        boxShadow: darkMode ? "0 14px 36px rgba(0,0,0,.34)" : "0 14px 36px rgba(37,99,235,.18)",
                        border: `1px solid ${darkMode ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)"}`,
                      }}
                    >
                      {f.icon}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.02em" }}>{f.title}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: t.heroMuted, lineHeight: 1.55, fontWeight: 550 }}>{f.desc}</div>
                    </div>
                  </div>

                  <div style={{ position: "relative", marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Pill bg={darkMode ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.05)"} color={t.heroMuted} border={`1px solid ${t.stroke}`}>
                      <Dot c={f.accent} /> Quick actions
                    </Pill>
                    <Pill bg={darkMode ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.05)"} color={t.heroMuted} border={`1px solid ${t.stroke}`}>
                      <Dot c={t.accent2} /> Clean UI
                    </Pill>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section style={{ padding: "42px 0 20px" }}>
          <div className="hp-container">
            <div
              style={{
                borderRadius: 22,
                border: `1px solid ${t.stroke}`,
                background: darkMode
                  ? "linear-gradient(180deg, rgba(15,23,42,.72) 0%, rgba(10,14,26,.74) 100%)"
                  : "linear-gradient(180deg, rgba(255,255,255,.94) 0%, rgba(250,252,255,.92) 100%)",
                boxShadow: t.softShadowHover,
                padding: "22px 18px",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: -1,
                  background: `
                    radial-gradient(760px 320px at 15% 10%, ${t.glowB}, transparent 60%),
                    radial-gradient(800px 340px at 90% 30%, ${t.glowC}, transparent 60%)
                  `,
                  opacity: darkMode ? 0.62 : 0.72,
                }}
              />

              <div style={{ position: "relative", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", color: t.heroMuted }}>
                    How it works
                  </div>
                  <h3 style={{ marginTop: 8, fontSize: "clamp(18px, 2.6vw, 28px)", fontWeight: 950, letterSpacing: "-0.03em" }}>
                    From setup to insights—simple flow
                  </h3>
                </div>
                <Pill bg={darkMode ? "rgba(255,255,255,.06)" : "rgba(15,23,42,.05)"} color={t.heroMuted} border={`1px solid ${t.stroke}`}>
                  <Dot c={t.accent} /> Built for speed
                </Pill>
              </div>

              <div style={{ marginTop: 16 }} className="hp-grid-steps">
                {steps.map((s, idx) => (
                  <div
                    key={s.k}
                    style={{
                      borderRadius: 18,
                      border: `1px solid ${t.stroke}`,
                      background: darkMode ? "rgba(10,14,26,.55)" : "rgba(255,255,255,.78)",
                      padding: "14px 14px 16px",
                      boxShadow: "0 14px 40px rgba(2,6,23,.08)",
                      animation: `fadeUp .55s ease ${0.06 + idx * 0.06}s both`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 950, letterSpacing: "0.12em", color: t.heroMuted }}>{s.k}</div>
                      <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: idx % 2 ? t.accent2 : t.accent3, opacity: 0.9 }} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 14, fontWeight: 950, letterSpacing: "-0.02em" }}>{s.title}</div>
                    <div style={{ marginTop: 6, fontSize: 13, color: t.heroMuted, lineHeight: 1.55, fontWeight: 550 }}>{s.desc}</div>
                  </div>
                ))}
              </div>

              <div style={{ position: "relative", marginTop: 16, display: "flex", justifyContent: "center" }}>
                <button
                  type="button"
                  className="hp-btn"
                  onClick={onGetStarted}
                  style={{
                    padding: "12px 18px",
                    borderRadius: 14,
                    color: "#fff",
                    background: primaryBtnBg,
                    fontSize: 14,
                    fontWeight: 850,
                    border: `1px solid ${darkMode ? "rgba(255,255,255,.10)" : "rgba(15,23,42,.08)"}`,
                    boxShadow: darkMode ? "0 18px 60px rgba(59,130,246,.24)" : "0 18px 60px rgba(37,99,235,.20)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.filter = "brightness(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  Access your account
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* CTA band */}
        <section style={{ padding: "42px 0 52px" }}>
          <div className="hp-container">
            <div
              style={{
                borderRadius: 26,
                overflow: "hidden",
                border: `1px solid ${t.stroke}`,
                background: primaryBtnBg,
                boxShadow: darkMode ? "0 30px 120px rgba(0,0,0,.45)" : "0 30px 120px rgba(37,99,235,.22)",
                position: "relative",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background: darkMode
                    ? "linear-gradient(180deg, rgba(0,0,0,.10) 0%, rgba(0,0,0,.22) 100%)"
                    : "linear-gradient(180deg, rgba(255,255,255,.10) 0%, rgba(255,255,255,.22) 100%)",
                }}
              />
              <div style={{ position: "relative", padding: "26px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
                <div style={{ color: "#fff", minWidth: 260 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase", opacity: 0.92 }}>
                    Ready to launch
                  </div>
                  <div style={{ fontSize: "clamp(20px, 3vw, 30px)", fontWeight: 950, letterSpacing: "-0.03em", marginTop: 8 }}>
                    Give your check-in experience a glow-up.
                  </div>
                  <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, opacity: 0.92, fontWeight: 600, maxWidth: 720 }}>
                    Faster entrances, cleaner data, and leadership-ready reports—without the clutter.
                  </div>
                </div>

                <button
                  type="button"
                  className="hp-btn"
                  onClick={onGetStarted}
                  style={{
                    padding: "14px 18px",
                    borderRadius: 14,
                    background: "rgba(255,255,255,.92)",
                    color: "#0b1220",
                    fontSize: 14,
                    fontWeight: 900,
                    letterSpacing: "-0.01em",
                    border: "1px solid rgba(255,255,255,.65)",
                    boxShadow: "0 16px 46px rgba(2,6,23,.18)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.filter = "brightness(1.03)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.filter = "none";
                  }}
                >
                  Sign In <span aria-hidden>→</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer style={{ background: t.footerBg, borderTop: `1px solid ${t.stroke}`, padding: "28px 0 34px", position: "relative", zIndex: 1 }}>
        <div className="hp-container" style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 36,
                height: 36,
                borderRadius: 14,
                background: gradText,
                opacity: 0.95,
                border: `1px solid ${darkMode ? "rgba(255,255,255,.12)" : "rgba(15,23,42,.08)"}`,
              }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.02em", color: t.heroText }}>TLOB AMS</div>
              <div style={{ fontSize: 12, color: t.heroMuted, fontWeight: 650 }}>Building community, one check-in at a time.</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: t.heroMuted, fontWeight: 650 }}>
            © {Year} TLOB Attendance Management System. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
