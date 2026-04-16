import { useState, useEffect } from "react";
import { toDataURL } from "qrcode";

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

export { generateQRMatrix, QRCode, getQRDataUrl };
