import { useState, useEffect } from "react";
import { toDataURL } from "qrcode";
import html2canvas from "html2canvas";

// ─── QR CODE COMPONENT ───────────────────────────────────────────────────────
// Uses the `qrcode` npm package to generate a data URI which renders correctly
// and is recognizable by camera scanners (html5-qrcode, phones, etc.).
function QRCode({ value, size = 120, dark = "#1a1a2e" }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let cancelled = false;
    toDataURL(value, { width: size, margin: 0, color: { dark, light: "#ffffff" } })
      .then(url => { if (!cancelled) setSrc(url); })
      .catch(() => { /* swallow errors silently */ });
    return () => { cancelled = true; };
  }, [value, size, dark]);
  if (!src) return null;
  return <img src={src} width={size} height={size} alt="QR code" />;
}

// legacy matrix generator retained for backwards printing logic (optional)
function generateQRMatrix(data) {
  console.warn("generateQRMatrix is deprecated; use QRCode component or qrcode library instead.");
  const hash = data.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const size = 21;
  const matrix = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const inFinder = (r < 7 && c < 7) || (r < 7 && c >= 14) || (r >= 14 && c < 7);
      if (inFinder) {
        const fr = r < 7 ? r : r - 14, fc = c < 7 ? c : c >= 14 ? c - 14 : c;
        return (fr === 0 || fr === 6 || fc === 0 || fc === 6 || (fr >= 2 && fr <= 4 && fc >= 2 && fc <= 4)) ? 1 : 0;
      }
      return ((r * size + c + hash + r * 3 + c * 7) % 3 === 0) ? 1 : 0;
    })
  );
  return matrix;
}

// helper that returns a promise resolving to a data URI; useful for printing
function getQRDataUrl(value, options = {}) {
  return toDataURL(value, options);
}

function getQRJpgDataUrl(value, size = 180) {
  return getQRDataUrl(value, {
    width: size,
    margin: 1,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  }).then(pngDataUrl => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, size, size);
      context.drawImage(image, 0, 0, size, size);
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    image.onerror = reject;
    image.src = pngDataUrl;
  }));
}

async function getQRCardJpgDataUrl(member, logoSrc) {
  const qrDataUrl = await getQRDataUrl(`TLOB:${member.id}:${member.name}`, {
    width: 360,
    margin: 1,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  const card = document.createElement("div");
  card.style.cssText = "width:250px;height:310px;border:5px solid #000;border-radius:8px;padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:#fff;gap:0;font-family:Inter,system-ui,sans-serif;box-sizing:border-box;position:fixed;left:-10000px;top:0;";
  card.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;width:100%;background:#1e293b;color:#fff;padding:3px 6px;border-radius:5px;border:1px solid #0f172a;flex-shrink:0;box-sizing:border-box;">
      <img src="${logoSrc}" style="width:18px;height:18px;border-radius:50%;border:1px solid rgba(255,255,255,.3);object-fit:cover;flex-shrink:0;">
      <div style="font-size:10px;font-weight:700;line-height:1.1;flex:1;">TLOB<br>Member ID</div>
    </div>
    <div style="padding:4px;border:1.5px solid #144dbe;border-radius:6px;background:#f9fafb;display:flex;align-items:center;justify-content:center;flex:1;margin-top:6px;margin-bottom:6px;box-sizing:border-box;">
      <img src="${qrDataUrl}" style="width:180px;height:175px;display:block;">
    </div>
    <div style="font-weight:700;font-size:13px;text-align:center;color:#000;max-width:100%;line-height:1.1;margin:0 0 3px;">${escapeHtml(member.name || "")}</div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:100%;flex:0;justify-content:flex-start;">
      <div style="display:flex;align-items:center;justify-content:center;gap:2px;width:100%;">
        <span style="padding:0 2px;border-radius:2px;background:#f3f4f6;color:#374151;border:.5px solid #d1d5db;white-space:nowrap;font-size:8px;">${escapeHtml(member.id)}</span>
        <span style="padding:0 4px;border-radius:2px;background:#e0f2fe;color:#0369a1;border:.5px solid #06b6d4;white-space:nowrap;font-weight:600;font-size:8px;min-height:14px;"><span style="display:inline-flex;width:3px;height:3px;border-radius:50%;margin-right:2px;vertical-align:middle;background:${member.status === "Active" ? "#10b981" : "#ef4444"};"></span>${escapeHtml(member.status || "")}</span>
      </div>
      <div style="width:100%;text-align:center;font-size:8px;font-weight:600;color:#666;border-top:1px solid #5d5f64;padding-top:3px;margin-top:3px;box-sizing:border-box;">Gamitin sa iyong weekly attendance.</div>
    </div>`;
  document.body.appendChild(card);
  await Promise.all(Array.from(card.querySelectorAll("img")).map(image => image.complete ? Promise.resolve() : new Promise(resolve => { image.onload = resolve; image.onerror = resolve; })));
  const rendered = await html2canvas(card, { width: 250, height: 310, scale: 2, backgroundColor: "#ffffff", useCORS: true });
  card.remove();
  return rendered.toDataURL("image/jpeg", 0.95);
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export { generateQRMatrix, QRCode, getQRDataUrl, getQRJpgDataUrl, getQRCardJpgDataUrl, downloadDataUrl };
