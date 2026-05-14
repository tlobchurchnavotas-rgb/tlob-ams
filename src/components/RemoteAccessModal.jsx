import { useEffect, useMemo, useState } from "react";
import { Icon } from "./Icon.jsx";
import { QRCode } from "../utils/qr.js";

function normalizeHost(h) {
  const host = (h || "").trim();
  if (!host) return "";
  return host.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
}

function buildUrl({ protocol, host, port, pathname = "/" }) {
  const h = normalizeHost(host);
  if (!h) return "";
  const p = String(port || "").trim();
  const needsPort = p && p !== "80" && p !== "443";
  const base = `${protocol}//${h}${needsPort ? `:${p}` : ""}`;
  return `${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean))];
}

function isPrivateIpv4(ip) {
  // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  if (!ip) return false;
  const parts = ip.split(".").map((x) => parseInt(x, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  return false;
}

function isLikelyVirtualAdapterIp(ip) {
  // Common on Windows when WSL/Hyper-V is enabled; iPad/phone usually can't reach this.
  return /^172\.23\./.test(ip || "");
}

async function detectLanIps({ timeoutMs = 1500 } = {}) {
  // Best-effort: works in Chromium-based browsers; may be blocked elsewhere.
  const RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
  if (!RTCPeerConnection) return [];

  const ips = new Set();
  const pc = new RTCPeerConnection({ iceServers: [] });

  const done = () => {
    try { pc.onicecandidate = null; } catch {}
    try { pc.close(); } catch {}
    return uniq([...ips]);
  };

  return await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(done()), timeoutMs);

    pc.onicecandidate = (e) => {
      const cand = e?.candidate?.candidate || "";
      const m = cand.match(/(\d{1,3}(\.\d{1,3}){3})/g);
      if (m) {
        m.forEach((ip) => {
          if (ip !== "127.0.0.1" && isPrivateIpv4(ip)) ips.add(ip);
        });
      }
      if (!e.candidate) {
        clearTimeout(timer);
        resolve(done());
      }
    };

    pc.createDataChannel("x");
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => {
        clearTimeout(timer);
        resolve(done());
      });
  });
}

export default function RemoteAccessModal({ theme, onClose, title = "Remote Access" }) {
  const loc = typeof window !== "undefined" ? window.location : { protocol: "http:", hostname: "localhost", port: "", pathname: "/" };

  const [appInfo, setAppInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof window !== "undefined" && window.tlob?.getAppInfo) {
          const info = await window.tlob.getAppInfo();
          if (!cancelled) setAppInfo(info);
        }
      } catch {
        if (!cancelled) setAppInfo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const port = useMemo(() => String(loc.port || "3000").trim() || "3000", [loc.port]);

  const protocol = useMemo(() => {
    if (appInfo?.embeddedRemoteHttpsListening) return "https:";
    if (loc.protocol === "file:") return "https:";
    if (loc.protocol === "https:") return "https:";
    return "http:";
  }, [appInfo?.embeddedRemoteHttpsListening, loc.protocol]);

  const [host, setHost] = useState(() => (loc.hostname || "localhost"));
  const [copied, setCopied] = useState(false);
  const [ipOptions, setIpOptions] = useState([]);
  const [ipDetecting, setIpDetecting] = useState(false);
  const [ipHint, setIpHint] = useState(null);

  const url = useMemo(() => buildUrl({ protocol, host, port, pathname: "/" }), [protocol, host, port]);
  const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(normalizeHost(host));

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isLocalhost) return;
      setIpDetecting(true);
      try {
        const ips = await detectLanIps({ timeoutMs: 1600 });
        if (cancelled) return;
        setIpOptions(ips);
        if (ips.length === 1 && !isLikelyVirtualAdapterIp(ips[0])) setHost(ips[0]);
        if (ips.some(isLikelyVirtualAdapterIp) && !ips.some((ip) => ip.startsWith("192.168."))) {
          setIpHint("Detected a virtual adapter IP (172.23.x.x). Use your Wi‑Fi IPv4 (often 192.168.x.x) from Windows ipconfig.");
        } else if (ips.some(isLikelyVirtualAdapterIp) && ips.some((ip) => ip.startsWith("192.168."))) {
          setIpHint("Multiple IPs detected. Prefer your Wi‑Fi IP (usually 192.168.x.x), not 172.23.x.x.");
        } else {
          setIpHint(null);
        }
      } finally {
        if (!cancelled) setIpDetecting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isLocalhost]);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignore (clipboard may be blocked on some browsers)
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-box"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 18,
          padding: 22,
          width: "100%",
          maxWidth: 560,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: "-.02em" }}>{title}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              Scan the QR code from your iPad (same Wi‑Fi) to open the system.
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label>Device URL</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={url || ""}
                  readOnly
                  style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }}
                />
                <button
                  className="btn"
                  onClick={copy}
                  disabled={!url}
                  style={{
                    background: copied ? `${theme.success}18` : theme.surface2,
                    color: copied ? theme.success : theme.textMuted,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${theme.border}`,
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    opacity: url ? 1 : 0.5,
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 7, lineHeight: 1.5 }}>
                {isLocalhost ? (
                  <>
                    You are currently on <b>localhost</b>. Use your PC LAN IP so your iPad can open it.
                  </>
                ) : (
                  <>
                    Make sure the iPad is on the <b>same Wi‑Fi</b> as this PC.
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
              <div>
                <label>Host / IP</label>
                <input type="text" value={host} onChange={(e) => setHost(e.target.value)} placeholder="e.g. 192.168.1.29" />
                {isLocalhost && (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>
                      {ipDetecting ? "Detecting IP…" : ipOptions.length ? "Detected:" : "No IP detected"}
                    </span>
                    {ipOptions.map((ip) => (
                      <button
                        key={ip}
                        className="btn"
                        onClick={() => setHost(ip)}
                        style={{
                          background: host === ip ? `${theme.accent}18` : theme.surface2,
                          color: host === ip ? theme.accent : theme.textMuted,
                          border: `1px solid ${theme.border}`,
                          padding: "5px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                        title="Use this IP"
                      >
                        {ip}
                      </button>
                    ))}
                  </div>
                )}
                {isLocalhost && ipHint && (
                  <div style={{ marginTop: 8, fontSize: 11, color: theme.textMuted, lineHeight: 1.4 }}>
                    {ipHint}
                  </div>
                )}
              </div>
              <div>
                <label>Port</label>
                <input type="text" value={loc.port || "3000"} readOnly style={{ fontFamily: "DM Mono, monospace", fontSize: 12 }} />
              </div>
            </div>

            {appInfo && appInfo.isPackaged && !appInfo.embeddedRemoteHttpsListening && (
              <div style={{ padding: "10px 12px", background: `${theme.danger}12`, border: `1px solid ${theme.danger}35`, borderRadius: 12, fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
                <b style={{ color: theme.danger }}>Remote HTTPS did not start.</b> Another program may be using port 3000, or certificates could not be created. Tablets cannot use the camera scanner until this is fixed.
              </div>
            )}

            {loc.protocol === "http:" && !appInfo?.embeddedRemoteHttpsListening && (
              <div style={{ padding: "10px 12px", background: `${theme.danger}12`, border: `1px solid ${theme.danger}35`, borderRadius: 12, fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
                <b style={{ color: theme.danger }}>This page is not HTTPS.</b> The URL below matches what your PC is serving. For the <b>tablet camera scanner</b>, install and open the <b>TLOB AMS</b> desktop app on this PC and use Remote access from there (HTTPS starts automatically for tablets), or run <code style={{ fontFamily: "DM Mono, monospace" }}>npm run start:lan:https</code> for browser-only development.
              </div>
            )}

            {loc.protocol !== "http:" && (
            <div style={{ padding: "10px 12px", background: `${theme.accent}0d`, border: `1px solid ${theme.accent}25`, borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: theme.accent, marginBottom: 4 }}>Tablet camera scanning</div>
              <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
                {appInfo?.embeddedRemoteHttpsListening ? (
                  <>
                    The <b>TLOB AMS</b> desktop app on this PC is already serving a secure link for your tablet. Open the Device URL on the iPad and tap through Safari&apos;s certificate warning once if it appears.
                  </>
                ) : loc.protocol === "https:" ? (
                  <>
                    This session is already on HTTPS — tablets can use the camera scanner with the Device URL below (accept the certificate warning on the tablet if asked).
                  </>
                ) : loc.protocol === "file:" ? (
                  appInfo && appInfo.isPackaged && !appInfo.embeddedRemoteHttpsListening ? (
                    <>Fix the HTTPS issue above, then use the Device URL on your tablet.</>
                  ) : (
                    <>Use the Device URL (HTTPS) on your tablet. On first connect, accept Safari&apos;s certificate warning if it appears.</>
                  )
                ) : (
                  <>
                    For the in-browser camera on a tablet you need HTTPS. Prefer opening <b>TLOB AMS</b> on this PC and copying the link from here, or for developers use <code style={{ fontFamily: "DM Mono, monospace" }}>npm run start:lan:https</code>.
                  </>
                )}
              </div>
            </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ padding: 10, background: "white", borderRadius: 14, border: `1px solid ${theme.border}` }}>
              {url ? <QRCode value={url} size={200} dark="#111827" /> : <div style={{ width: 200, height: 200 }} />}
            </div>
            <div style={{ fontSize: 11, color: theme.textMuted, textAlign: "center" }}>
              Scan to open
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

