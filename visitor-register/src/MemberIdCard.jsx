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
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create JPEG."));
      },
      "image/jpeg",
      0.95,
    );
  });
}

async function saveJpegBlob(blob, filename) {
  const file = new File([blob], filename, { type: "image/jpeg" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  if (isIos) {
    window.open(objectUrl, "_blank", "noopener");
  }
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
    link.remove();
  }, 4000);
}

export default function MemberIdCard({ claim }) {
  const cardRef = useRef(null);
  const [qrSrc, setQrSrc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const payload = memberQrPayload(claim.memberId, claim.name);

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
      });
      const blob = await canvasToJpegBlob(rendered);
      const filename = `${safeFilenamePart(claim.memberId)}_${safeFilenamePart(claim.name)}_qr_card.jpg`;
      await saveJpegBlob(blob, filename);
    } catch (err) {
      setError(err?.message || "Could not download the member ID. Try again, or take a screenshot.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #dde3f0", borderRadius: 16, padding: 22, textAlign: "center", boxShadow: "0 10px 28px rgba(26,35,64,.08)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#5a6a8a", letterSpacing: ".08em" }}>VIRTUAL MEMBER ID</div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
        <div
          ref={cardRef}
          style={{
            width: 250,
            height: 310,
            border: "5px solid #000",
            borderRadius: 8,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff",
            gap: 0,
            fontFamily: "Inter, system-ui, sans-serif",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", background: "#1e293b", color: "#fff", padding: "3px 6px", borderRadius: 5, border: "1px solid #0f172a", flexShrink: 0, boxSizing: "border-box" }}>
            <img src={LOGO_SRC} alt="" style={{ width: 18, height: 18, borderRadius: "50%", border: "1px solid rgba(255,255,255,.3)", objectFit: "cover", flexShrink: 0 }} />
            <div style={{ fontSize: 10, fontWeight: 700, lineHeight: 1.1, flex: 1, textAlign: "left" }}>TLOB<br />Member ID</div>
          </div>
          <div style={{ padding: 4, border: "1.5px solid #144dbe", borderRadius: 6, background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", flex: 1, marginTop: 6, marginBottom: 6, boxSizing: "border-box", width: "100%" }}>
            {qrSrc
              ? <img src={qrSrc} alt="Member QR" style={{ width: 180, height: 175, display: "block" }} />
              : <div style={{ width: 180, height: 175 }} />}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, textAlign: "center", color: "#000", maxWidth: "100%", lineHeight: 1.1, margin: "0 0 3px" }}>{claim.name}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%", flex: 0, justifyContent: "flex-start" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, width: "100%" }}>
              <span style={{ padding: "0 2px", borderRadius: 2, background: "#f3f4f6", color: "#374151", border: ".5px solid #d1d5db", whiteSpace: "nowrap", fontSize: 8 }}>{claim.memberId}</span>
              <span style={{ padding: "0 4px", borderRadius: 2, background: "#e0f2fe", color: "#0369a1", border: ".5px solid #06b6d4", whiteSpace: "nowrap", fontWeight: 600, fontSize: 8, minHeight: 14, display: "inline-flex", alignItems: "center" }}>
                <span style={{ display: "inline-flex", width: 3, height: 3, borderRadius: "50%", marginRight: 2, background: "#10b981" }} />
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
    </div>
  );
}
