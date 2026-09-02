import { useEffect, useRef, useState } from "react";
import { toDataURL } from "qrcode";
import html2canvas from "html2canvas";
import { memberQrPayload } from "./claim.js";

const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;

function safeFilenamePart(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w.-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    || "member";
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

async function waitForImages(root) {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((image) => {
    if (image.complete && image.naturalWidth) return Promise.resolve();
    return new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
  }));
}

function canvasToJpegBlob(canvas) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else {
            try {
              const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
              resolve(dataUrlToBlob(dataUrl));
            } catch (error) {
              reject(error);
            }
          }
        },
        "image/jpeg",
        0.95,
      );
      return;
    }
    try {
      resolve(dataUrlToBlob(canvas.toDataURL("image/jpeg", 0.95)));
    } catch (error) {
      reject(error);
    }
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, body] = String(dataUrl).split(",");
  const mime = /data:(.*?);/.exec(header)?.[1] || "image/jpeg";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function saveJpegBlob(blob, filename) {
  const file = new File([blob], filename, { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 8000);
  return "downloaded";
}

export default function MemberIdCard({ claim }) {
  const cardRef = useRef(null);
  const [qrSrc, setQrSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savePreview, setSavePreview] = useState("");
  const payload = memberQrPayload(claim.memberId, claim.name);
  const filename = `${safeFilenamePart(claim.memberId)}_${safeFilenamePart(claim.name)}_qr_card.jpg`;

  useEffect(() => {
    document.title = "Virtual Member ID · TLOB";
    let cancelled = false;
    toDataURL(payload, { width: 360, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQrSrc(url); })
      .catch(() => { if (!cancelled) setError("Could not generate QR code."); });
    return () => { cancelled = true; };
  }, [payload]);

  const downloadJpg = async () => {
    const card = cardRef.current;
    if (!card || !qrSrc || busy) return;
    setBusy(true);
    setError("");
    try {
      await waitForImages(card);
      const rendered = await html2canvas(card, {
        width: 250,
        height: 310,
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        onclone: (doc) => {
          doc.documentElement.style.colorScheme = "only light";
          doc.body.style.background = "#ffffff";
          const cloned = doc.querySelector(".tlob-member-card");
          if (cloned) {
            cloned.style.background = "#ffffff";
            cloned.style.colorScheme = "only light";
          }
        },
      });
      const blob = await canvasToJpegBlob(rendered);
      const result = await saveJpegBlob(blob, filename);
      if (result === "cancelled") return;
      if (result !== "shared" && isIos()) {
        setSavePreview(URL.createObjectURL(blob));
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
        html { color-scheme: only light; }
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
        .tlob-member-card,
        .tlob-member-card * {
          color-scheme: only light !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .tlob-member-card {
          width: 250px;
          height: 310px;
          border: 5px solid #000000;
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
          color: #000000;
        }
        .tlob-member-card .card-header {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          background: #1e293b !important;
          color: #ffffff !important;
          padding: 3px 6px;
          border-radius: 5px;
          border: 1px solid #0f172a;
          flex-shrink: 0;
          box-sizing: border-box;
        }
        .tlob-member-card .card-logo {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,.3);
          object-fit: cover;
          flex-shrink: 0;
        }
        .tlob-member-card .card-title {
          font-size: 10px;
          font-weight: 700;
          line-height: 1.1;
          flex: 1;
          text-align: left;
          color: #ffffff !important;
        }
        .tlob-member-card .qr-box {
          padding: 4px;
          border: 1.5px solid #144dbe;
          border-radius: 6px;
          background: #f9fafb !important;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
          margin-top: 6px;
          margin-bottom: 6px;
          box-sizing: border-box;
          width: 100%;
        }
        .tlob-member-card .qr-box img {
          width: 180px;
          height: 175px;
          display: block;
        }
        .tlob-member-card .card-name {
          font-weight: 700;
          font-size: 13px;
          text-align: center;
          color: #000000 !important;
          max-width: 100%;
          line-height: 1.1;
          margin: 0 0 3px;
        }
        .tlob-member-card .card-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          width: 100%;
          flex: 0;
          justify-content: flex-start;
        }
        .tlob-member-card .card-status-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          width: 100%;
        }
        .tlob-member-card .tag {
          padding: 0 2px;
          border-radius: 2px;
          background: #f3f4f6 !important;
          color: #374151 !important;
          border: 0.5px solid #d1d5db;
          white-space: nowrap;
          font-size: 8px;
        }
        .tlob-member-card .tag-status {
          background: #e0f2fe !important;
          color: #0369a1 !important;
          border-color: #06b6d4;
          font-weight: 600;
          font-size: 8px;
          padding: 0 4px;
          min-height: 14px;
          display: inline-flex;
          align-items: center;
        }
        .tlob-member-card .dot {
          display: inline-flex;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          margin-right: 2px;
          background: #10b981 !important;
          color: #10b981;
          border: 0.5px solid currentColor;
        }
        .tlob-member-card .card-footer {
          width: 100%;
          text-align: center;
          font-size: 8px;
          font-weight: 600;
          color: #666666 !important;
          border-top: 1px solid #5d5f64;
          padding-top: 3px;
          margin-top: 3px;
          box-sizing: border-box;
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
        <div ref={cardRef} className="tlob-member-card">
          <div className="card-header">
            <img className="card-logo" src={LOGO_SRC} alt="" />
            <div className="card-title">TLOB<br />Member ID</div>
          </div>
          <div className="qr-box">
            {qrSrc
              ? <img src={qrSrc} alt="Member QR" />
              : <div style={{ width: 180, height: 175 }} />}
          </div>
          <div className="card-name">{claim.name}</div>
          <div className="card-info">
            <div className="card-status-row">
              <span className="tag">{claim.memberId}</span>
              <span className="tag tag-status">
                <span className="dot" />
                Active
              </span>
            </div>
            <div className="card-footer">Gamitin sa iyong weekly attendance. Huwag iwawala.</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, fontSize: 13, color: "#5a6a8a", lineHeight: 1.5 }}>
        Download this card and use the QR to log attendance at the kiosk.
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
            <div style={{ fontWeight: 800, fontSize: 16, color: "#1a2340" }}>Save to Photos</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "#5a6a8a", lineHeight: 1.45 }}>
              Press and hold the card, then tap Save Image to add it to your gallery.
            </div>
            <img src={savePreview} alt="Member ID card" style={{ width: "100%", marginTop: 14, borderRadius: 8 }} />
            <a
              href={savePreview}
              download={filename}
              style={{ display: "block", marginTop: 12, fontWeight: 700, fontSize: 14, color: "#6366f1" }}
            >
              Download JPG
            </a>
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(savePreview);
                setSavePreview("");
              }}
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
