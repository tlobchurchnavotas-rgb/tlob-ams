import { useEffect, useState } from "react";
import { ICON_PATHS } from "./Icon.jsx";
import { CHURCH_LOGO_SRC } from "../constants.js";

// Blue primary (blue-600/700) — reads clearly blue vs indigo #6366f1; matches app surfaces (#f0f4ff) + cyan accents in App.jsx
const C = {
  accent: "#2563eb",
  accent2: "#06b6d4",
  text: "#1a2340",
  textMuted: "#5a6a8a",
  inputBg: "#e8eeff",
  cardBg: "#f0f4ff",
};

const LOGIN_BG = `${process.env.PUBLIC_URL || ""}/login-welcome-bg.png`;

/** Source art: 1920×1080 (16:9). Scales uniformly to fill the viewport (cover); on exact FHD it maps edge-to-edge without stretching. */
function LoginBackgroundLayer() {
  const src = LOGIN_BG.replace(/'/g, "\\'");
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#cfe8f5",
        backgroundImage: `url('${src}')`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        backgroundPosition: "left center",
      }}
    />
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginPage({ onSignIn, darkMode: _darkMode, supabaseConfigured, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAccessNote, setShowAccessNote] = useState(false);
  const [showForgotPasswordNote, setShowForgotPasswordNote] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("ams_remember") === "1") {
        setRememberMe(true);
        setEmail(localStorage.getItem("ams_login_email") || "");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      if (rememberMe) {
        localStorage.setItem("ams_remember", "1");
        localStorage.setItem("ams_login_email", email);
      } else {
        localStorage.removeItem("ams_remember");
        localStorage.removeItem("ams_login_email");
      }
      await onSignIn(email, password);
    } catch (e) {
      setError(e?.message || "Sign in failed");
      setLoading(false);
    }
  };

  const inputShell = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "10px 14px 10px 12px",
    background: C.inputBg,
    borderRadius: 999,
    border: `1px solid ${error ? "#e11d48" : "transparent"}`,
  };

  return (
    <div
      className="login-fill-min"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "flex-start",
        fontFamily: "'DM Sans','Segoe UI',sans-serif",
        overflow: "hidden",
        padding: 0,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        html, body, #root { margin: 0; width: 100%; min-height: 100%; }
        * { box-sizing: border-box; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .login-btn:hover { filter: brightness(1.08); }
        .login-btn:active { transform: scale(0.99); }
        .login-link { cursor: pointer; background: none; border: none; font: inherit; color: ${C.accent}; text-decoration: underline; text-underline-offset: 2px; padding: 0; }
        .login-link:hover { opacity: 0.85; }
        input::placeholder { color: rgba(26, 35, 64, 0.42); }
        @media (max-width: 720px) {
          .login-split { grid-template-columns: 1fr !important; }
        }
        .login-fill-min { min-height: 100vh; min-height: 100dvh; }
      `}</style>

      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <LoginBackgroundLayer />
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          style={{
            position: "fixed",
            top: 20,
            left: 20,
            zIndex: 50,
            padding: "10px 16px",
            background: "rgba(240, 244, 255, 0.95)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgb(255, 255, 255)",
            borderRadius: 20,
            color: C.accent, 
            fontSize: 13,
            fontWeight: 200,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.9s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(240, 244, 255, 1)";
            e.currentTarget.style.boxShadow = "0 8px 16px rgba(15, 23, 42, 0.15)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(240, 244, 255, 0.95)";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          <span style={{ fontSize:10 }}>←</span> Back to Home
        </button>
      )}

      <div
        className="login-split login-fill-min"
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          alignSelf: "stretch",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "minmax(0, 0.70fr) minmax(0, 0.50fr)",
          boxSizing: "border-box",
        }}
      >
        <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingBlock: "clamp(20px, 4vh, 48px)",
            paddingInline: "clamp(16px, 3.25vw, 40px)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 500,
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.22)",
              animation: "fadeUp .45s ease",
              background: "rgba(255, 255, 255, 0.96)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "3px solid rgba(0, 110, 255, 0.9)",
            }}
          >
        <div style={{ background: "transparent", padding: "22px 26px 24px" }}>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 0, marginBottom: 16 }}>
            <img
              src={CHURCH_LOGO_SRC}
              alt="The Lord Our Banner Christian Church"
              width={88}
              height={88}
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                objectFit: "contain",
                border: `3px solid ${C.cardBg}`,
                boxShadow: "0 6px 20px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(37, 99, 235, 0.22)",
                background: "#fff",
                padding: 2,
                boxSizing: "border-box",
              }}
            />
          </div>
          <h1 style={{ color: C.text, fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em", textAlign: "center" }}>Login into AMS</h1>
          <p style={{ color: C.textMuted, fontSize: 11, fontWeight: 500, margin: "0 0 20px", textAlign: "center" }}>The Lord Our Banner — Attendance Management System</p>

          {!supabaseConfigured && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                background: "rgba(245, 158, 11, 0.12)",
                borderRadius: 10,
                border: "1px solid rgba(245, 158, 11, 0.25)",
                color: "#b45309",
                fontSize: 11,
                lineHeight: 1.45,
              }}
            >
              Supabase is not configured. Add <code style={{ color: "#78350f" }}>REACT_APP_SUPABASE_URL</code> and{" "}
              <code style={{ color: "#78350f" }}>REACT_APP_SUPABASE_ANON_KEY</code> to <code style={{ color: "#78350f" }}>.env</code> then restart{" "}
              <code style={{ color: "#78350f" }}>npm start</code>.
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={inputShell}>
              <span style={{ color: C.accent, display: "flex", flexShrink: 0 }} aria-hidden>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                  <path d={ICON_PATHS.profile} />
                </svg>
              </span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  background: "transparent",
                  color: C.text,
                  fontSize: 14,
                  fontWeight: 500,
                  outline: "none",
                  fontFamily: "inherit",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ ...inputShell, paddingRight: 10 }}>
              <span style={{ color: C.accent, display: "flex", flexShrink: 0 }} aria-hidden>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
                  <path d={ICON_PATHS.key} />
                </svg>
              </span>
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Password"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  background: "transparent",
                  color: C.text,
                  fontSize: 14,
                  fontWeight: 500,
                  outline: "none",
                  fontFamily: "inherit",
                }}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <button
                type="button"
                className="btn"
                onClick={() => setShowPw(!showPw)}
                style={{
                  flexShrink: 0,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 4,
                  color: C.textMuted,
                  opacity: 0.85,
                  display: "flex",
                }}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="currentColor">
                  <path d={showPw ? ICON_PATHS.eyeOff : ICON_PATHS.eye} />
                </svg>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                role="switch"
                aria-checked={rememberMe}
                onClick={() => setRememberMe(!rememberMe)}
                style={{
                  width: 44,
                  height: 24,
                  borderRadius: 12,
                  cursor: "pointer",
                  padding: 3,
                  border: rememberMe ? "none" : "1px solid #dde3f0",
                  background: rememberMe ? C.accent : "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: rememberMe ? "flex-end" : "flex-start",
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: rememberMe ? "0 1px 3px rgba(0,0,0,.2)" : "0 0 0 1px rgba(148,163,184,.45)",
                  }}
                />
              </button>
              <span style={{ color: C.text, fontSize: 12, fontWeight: 500 }}>remember me</span>
            </div>
            <button
              type="button"
              className="login-link"
              style={{ fontSize: 12, fontWeight: 500 }}
              onClick={() => {
                setShowForgotPasswordNote((v) => !v);
                setError("");
              }}
            >
              forgot password
            </button>
          </div>

          {showForgotPasswordNote && (
            <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.45, marginBottom: 14, textAlign: "right" }}>
              Contact your system administrator to reset your password.
            </div>
          )}

          {error && <div style={{ color: "#e11d48", fontSize: 12, marginBottom: 12, textAlign: "center" }}>{error}</div>}

          <button
            type="button"
            className="login-btn btn"
            onClick={handleLogin}
            disabled={loading || !supabaseConfigured}
            style={{
              width: "100%",
              padding: "13px",
              background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !supabaseConfigured ? "not-allowed" : "pointer",
              opacity: loading || !supabaseConfigured ? 0.65 : 1,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {loading ? (
              <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .65s linear infinite" }} />
            ) : (
              "Login"
            )}
          </button>

          <div style={{ textAlign: "center", marginTop: 18 }}>
            <button type="button" className="login-link" style={{ fontSize: 12, fontWeight: 500 }} onClick={() => setShowAccessNote(!showAccessNote)}>
              Create account
            </button>
            {showAccessNote && (
              <p style={{ margin: "10px 0 0", fontSize: 11, color: C.textMuted, lineHeight: 1.5, maxWidth: 280, marginLeft: "auto", marginRight: "auto" }}>
                New accounts are created by your system administrator. If you need access or forgot your password, contact your admin.
              </p>
            )}
          </div>
        </div>
          </div>
        </div>
        <div aria-hidden style={{ minWidth: 0 }} />
      </div>
    </div>
  );
}

export default LoginPage;
