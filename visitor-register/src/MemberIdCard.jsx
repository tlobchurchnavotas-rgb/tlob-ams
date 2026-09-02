import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { memberQrPayload } from "./claim.js";
import {
  downloadJpegDataUrl,
  fetchAsDataUrl,
  getQRCardJpgDataUrl,
  jpegDataUrlToBlob,
} from "./memberCardDownload.js";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

function safeFilenamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w.-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    || "member";
}

export default function MemberIdCard({ claim }) {
  const [qrSrc, setQrSrc] = useState("");
  const [logoSrc, setLogoSrc] = useState(LOGO_SRC);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savePreview, setSavePreview] = useState("");
  const payload = memberQrPayload(claim.memberId, claim.name);
  const filename = `${safeFilenamePart(claim.memberId)}_${safeFilenamePart(claim.name)}_qr_card.jpg`;
  const member = { id: claim.memberId, name: claim.name, status: "Active" };

  useEffect(() => {
    document.title = "Virtual Member ID · TLOB";
    let cancelled = false;
    toDataURL(payload, { width: 360, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => { if (!cancelled) setError("Could not generate QR code."); });
    fetchAsDataUrl(LOGO_SRC)
      .then((url) => { if (!cancelled) setLogoSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [payload]);

  const downloadJpg = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const dataUrl = await getQRCardJpgDataUrl(member, logoSrc);
      downloadJpegDataUrl(dataUrl, filename);
      setSavePreview(dataUrl);

      try {
        const file = new File([jpegDataUrlToBlob(dataUrl)], filename, { type: "image/jpeg" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
        }
      } catch (shareError) {
        if (shareError?.name !== "AbortError") {
          /* keep the on-screen JPG so they can save it */
        }
      }
    } catch (err) {
      setError(err?.message || "Could not download the member ID. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tlob-claim-wrap">
      <style>{`
        .tlob-claim-wrap {
          color-scheme: only light;
          background: #ffffff;
          border: 1px solid #dde3f0;
          border-radius: 16px;
          padding: 22px;
          text-align: center;
          box-shadow: 0 10px 28px rgba(26,35,64,.08);
        }
        .tlob-claim-label {
          font-size: 12px;
          font-weight: 700;
          color: #5a6a8a;
          letter-spacing: .08em;
        }
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
          background: #fff;
          gap: 0;
          font-family: Inter, system-ui, sans-serif;
          box-sizing: border-box;
          color-scheme: only light;
        }
        .tlob-save-overlay {
          position: fixed;
          inset: 0;
          z-index: 40;
          background: rgba(9,16,28,.72);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .tlob-save-sheet {
          width: min(100%, 360px);
          background: #ffffff;
          color-scheme: only light;
          border-radius: 16px;
          padding: 18px;
          text-align: center;
        }
      `}</style>
      <div className="tlob-claim-label">VIRTUAL MEMBER ID</div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
        <div className="tlob-member-card" style={{ colorScheme: "only light" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "#1e293b", color: "#fff", padding: "3px 6px", borderRadius: 5, border: "1px solid #0f172a", flexShrink: 0, boxSizing: "border-box" }}>
            <img src={logoSrc} alt="" style={{ width: 18, height: 18, borderRadius: "50%", border: "1px solid rgba(255,255,255,.3)", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.1, flex: 1, textAlign: "left" }}>TLOB<br />Member ID</div>
          </div>
          <div style={{ padding: 4, border: "1.5px solid #144dbe", borderRadius: 6, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", flex: 1, marginTop: 6, marginBottom: 6, boxSizing: "border-box", width: "100%" }}>
            {qrSrc ? <img src={qrSrc} alt="" draggable="false" style={{ width: 180, height: 175, display: "block", pointerEvents: "none", WebkitTouchCallout: "none", userSelect: "none" }} /> : <div style={{ width: 180, height: 175 }} />}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, textAlign: "center", color: "#000", maxWidth: "100%", lineHeight: 1.1, margin: "0 0 3px" }}>{claim.name}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, width: "100%" }}>
              <span style={{ padding: "0 2px", borderRadius: 2, background: "#f3f4f6", color: "#374151", border: ".5px solid #d1d5db", whiteSpace: "nowrap", fontSize: 8 }}>{claim.memberId}</span>
              <span style={{ padding: "0 4px", borderRadius: 2, background: "#e0f2fe", color: "#0369a1", border: ".5px solid #06b6d4", whiteSpace: "nowrap", fontWeight: 600, fontSize: 8, minHeight: 14 }}>
                <span style={{ display: "inline-flex", width: 3, height: 3, borderRadius: "50%", marginRight: 2, verticalAlign: "middle", background: "#10b981" }} />
                Active
              </span>
            </div>
            <div style={{ width: "100%", textAlign: "center", fontSize: 8, fontWeight: 600, color: "#666", borderTop: "1px solid #5d5f64", paddingTop: 3, marginTop: 3, boxSizing: "border-box" }}>
              Gamitin sa iyong weekly attendance. Huwag iwawala.
            </div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, fontSize: 13, color: "#5a6a8a", lineHeight: 1.5 }}>
        Download the full member ID card (not just the QR) and use it at the kiosk.
      </div>
      {error && <div style={{ marginTop: 8, fontSize: 13, color: "#ef4444" }}>{error}</div>}
      <button
        type="button"
        onClick={downloadJpg}
        disabled={!qrSrc || busy}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "12px 16px",
          borderRadius: 10,
          border: "none",
          background: "#6366f1",
          color: "white",
          fontWeight: 800,
          fontSize: 15,
          cursor: !qrSrc || busy ? "wait" : "pointer",
          fontFamily: "inherit",
          opacity: qrSrc && !busy ? 1 : 0.6,
        }}
      >
        {busy ? "Preparing…" : "Download JPG"}
      </button>

      {savePreview && (
        <div className="tlob-save-overlay" role="dialog" aria-label="Save member ID">
          <div className="tlob-save-sheet">
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1a2340" }}>Your member ID card</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#5a6a8a", lineHeight: 1.45 }}>
              If the file did not save, press and hold the card below, then tap Save Image.
            </div>
            <img
              src={savePreview}
              alt="TLOB member ID card"
              style={{ width: 250, maxWidth: "100%", height: "auto", marginTop: 14, border: "1px solid #dde3f0", background: "#fff" }}
            />
            <a
              href={savePreview}
              download={filename}
              style={{ display: "inline-block", marginTop: 14, padding: "12px 16px", borderRadius: 10, background: "#6366f1", color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none" }}
            >
              Save JPG
            </a>
            <button
              type="button"
              onClick={() => setSavePreview("")}
              style={{ marginTop: 10, width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #dde3f0", background: "#f4f7ff", color: "#1a2340", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
