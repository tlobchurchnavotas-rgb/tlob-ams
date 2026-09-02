import { toDataURL } from "qrcode";
import html2canvas from "html2canvas";

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function fetchAsDataUrl(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error("Could not load image.");
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

export function jpegDataUrlToBlob(dataUrl) {
  const body = String(dataUrl).split(",")[1] || "";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: "image/jpeg" });
}

export function downloadJpegDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Identical to AMS `src/utils/qr.js` getQRCardJpgDataUrl (MembersView Download JPG).
export async function getQRCardJpgDataUrl(member, logoSrc) {
  const qrDataUrl = await toDataURL(`TLOB:${member.id}:${member.name}`, {
    width: 360,
    margin: 1,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  const card = document.createElement("div");
  card.style.cssText = "width:250px;height:310px;border:5px solid #000;border-radius:8px;padding:8px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;background:#fff;gap:0;font-family:Inter,system-ui,sans-serif;box-sizing:border-box;position:fixed;left:-10000px;top:0;color-scheme:only light;";
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
        <span style="padding:0 4px;border-radius:2px;background:#e0f2fe;color:#0369a1;border:.5px solid #06b6d4;white-space:nowrap;font-weight:600;font-size:8px;min-height:14px;"><span style="display:inline-flex;width:3px;height:3px;border-radius:50%;margin-right:2px;vertical-align:middle;background:${member.status === "Active" ? "#10b981" : "#ef4444"};"></span>${escapeHtml(member.status || "Active")}</span>
      </div>
      <div style="width:100%;text-align:center;font-size:8px;font-weight:600;color:#666;border-top:1px solid #5d5f64;padding-top:3px;margin-top:3px;box-sizing:border-box;">Gamitin sa iyong weekly attendance. Huwag iwawala.</div>
    </div>`;
  document.body.appendChild(card);
  await Promise.all(Array.from(card.querySelectorAll("img")).map((image) => (
    image.complete ? Promise.resolve() : new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    })
  )));
  const rendered = await html2canvas(card, {
    width: 250,
    height: 310,
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
  });
  card.remove();
  return rendered.toDataURL("image/jpeg", 0.95);
}
