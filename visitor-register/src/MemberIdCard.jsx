import { useEffect, useRef, useState } from "react";
import { toDataURL } from "qrcode";
import { memberQrPayload } from "./claim.js";
import { captureCardPng, fetchAsDataUrl, saveImageBlob } from "./memberCardDownload.js";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

function safeFilenamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w.-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    || "member";
}

export default function MemberIdCard({ claim }) {
  const cardRef = useRef(null);
  const blobRef = useRef(null);
  const [qrSrc, setQrSrc] = useState("");
  const [logoSrc, setLogoSrc] = useState(LOGO_SRC);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const payload = memberQrPayload(claim.memberId, claim.name);
  const filename = `${safeFilenamePart(claim.memberId)}_${safeFilenamePart(claim.name)}_qr_card.png`;

  useEffect(() => {
    document.title = "Virtual Member Card";
    let cancelled = false;
    toDataURL(payload, { width: 360, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => { if (!cancelled) setError("Could not generate QR code."); });
    fetchAsDataUrl(LOGO_SRC)
      .then((url) => { if (!cancelled) setLogoSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [payload]);

  useEffect(() => {
    if (!qrSrc || !cardRef.current) return undefined;
    let cancelled = false;
    blobRef.current = null;
    setReady(false);
    const timer = window.setTimeout(async () => {
      try {
        const blob = await captureCardPng(cardRef.current);
        if (cancelled) return;
        blobRef.current = blob;
        setReady(true);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err?.message || "Could not prepare the ID card.");
      }
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [qrSrc, logoSrc, claim.memberId, claim.name]);

  const saveCard = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      let blob = blobRef.current;
      if (!blob && cardRef.current) {
        blob = await captureCardPng(cardRef.current);
        blobRef.current = blob;
        setReady(true);
      }
      if (!blob) throw new Error("The ID card is still loading. Please wait a moment.");
      await saveImageBlob(blob, filename);
      setStatus("Saved. Check Photos or Downloads.");
    } catch (err) {
      if (err?.name === "AbortError") {
        setStatus("");
      } else {
        setError(err?.message || "Failed to download image. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tlob-claim-wrap">
      <style>{`
        .tlob-claim-wrap { color-scheme: only light; text-align: center; }
        .tlob-member-card {
          width: 250px;
          height: 310px;
          border: 5px solid #000;
          border-radius: 8px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          background: #ffffff !important;
          gap: 0;
          font-family: Inter, system-ui, sans-serif;
          box-sizing: border-box;
          color-scheme: only light;
        }
      `}</style>
      <div style={{ margin: "0 auto", display: "flex", justifyContent: "center" }}>
        <div ref={cardRef} className="tlob-member-card">
          <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "#1e293b", color: "#fff", padding: "3px 6px", borderRadius: 5, border: "1px solid #0f172a", flexShrink: 0, boxSizing: "border-box" }}>
            <img src={logoSrc} alt="" style={{ width: 18, height: 18, borderRadius: "50%", border: "1px solid rgba(255,255,255,.3)", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.1, flex: 1, textAlign: "left", color: "#fff" }}>TLOB<br />Member ID</div>
          </div>
          <div style={{ padding: 4, border: "1.5px solid #144dbe", borderRadius: 6, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", flex: 1, marginTop: 6, marginBottom: 6, boxSizing: "border-box", alignSelf: "center", width: "auto" }}>
            {qrSrc ? <img src={qrSrc} alt="" draggable="false" style={{ width: 180, height: 175, display: "block", pointerEvents: "none", WebkitTouchCallout: "none", userSelect: "none" }} /> : <div style={{ width: 180, height: 175 }} />}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, textAlign: "center", color: "#000", fontFamily: "Inter, system-ui, sans-serif", maxWidth: "100%", lineHeight: 1.1, margin: "0 0 3px" }}>{claim.name}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, width: "100%" }}>
              <span style={{ padding: "0 2px", borderRadius: 2, background: "#f3f4f6", color: "#374151", border: ".5px solid #d1d5db", whiteSpace: "nowrap", fontSize: 8, fontFamily: "Inter, system-ui, sans-serif" }}>{claim.memberId}</span>
              <span style={{ padding: "0 4px", borderRadius: 2, background: "#e0f2fe", color: "#0369a1", border: ".5px solid #06b6d4", whiteSpace: "nowrap", fontWeight: 600, fontSize: 8, minHeight: 14, fontFamily: "Inter, system-ui, sans-serif" }}>
                <span style={{ display: "inline-flex", width: 3, height: 3, borderRadius: "50%", marginRight: 2, verticalAlign: "middle", background: "#10b981" }} />
                Active
              </span>
            </div>
            <div style={{ width: "100%", textAlign: "center", fontSize: 8, fontWeight: 600, color: "#666", borderTop: "1px solid #5d5f64", paddingTop: 3, marginTop: 3, boxSizing: "border-box", fontFamily: "Inter, system-ui, sans-serif" }}>
              Gamitin sa iyong weekly attendance. Huwag iwawala.
            </div>
          </div>
        </div>
      </div>
      {error && <div style={{ marginTop: 14, fontSize: 13, color: "#ef4444", fontWeight: 700 }}>{error}</div>}
      {status && !error && <div style={{ marginTop: 14, fontSize: 13, color: "#10b981", fontWeight: 700 }}>{status}</div>}
      <button
        type="button"
        onClick={saveCard}
        disabled={!qrSrc || busy}
        style={{
          marginTop: 18,
          width: "100%",
          maxWidth: 360,
          padding: "13px 16px",
          borderRadius: 12,
          border: "none",
          background: "#6366f1",
          color: "white",
          fontWeight: 800,
          fontSize: 16,
          cursor: !qrSrc || busy ? "wait" : "pointer",
          fontFamily: "inherit",
          opacity: qrSrc && !busy ? 1 : 0.6,
        }}
      >
        {busy ? "Saving…" : "Save PNG"}
      </button>
      <div style={{ marginTop: 10, fontSize: 12, color: "#5a6a8a" }}>
        {ready ? "One tap saves the full member ID card." : "Preparing your card…"}
      </div>
    </div>
  );
}
