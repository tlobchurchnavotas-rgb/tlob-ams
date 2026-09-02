import { toDataURL } from "qrcode";

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
  const blob = jpegDataUrlToBlob(dataUrl);
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.type = "image/jpeg";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 20000);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load card image."));
    image.src = src;
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBadge(ctx, text, x, y, bg, fg, border) {
  ctx.font = "600 16px Inter, system-ui, sans-serif";
  const padX = 8;
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2;
  const h = 22;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, x + padX, y + h / 2 + 0.5);
  return w;
}

// Same 250x310 MembersView card, painted to JPEG so phones cannot save "QR only".
export async function getQRCardJpgDataUrl(member, logoSrc) {
  const scale = 2;
  const width = 250 * scale;
  const height = 310 * scale;
  const qrDataUrl = await toDataURL(`TLOB:${member.id}:${member.name}`, {
    width: 360,
    margin: 1,
    color: { dark: "#1a1a2e", light: "#ffffff" },
  });
  const [qrImage, logoImage] = await Promise.all([
    loadImage(qrDataUrl),
    logoSrc ? loadImage(logoSrc).catch(() => null) : Promise.resolve(null),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#ffffff";
  roundRect(ctx, 0, 0, width, height, 16);
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#000000";
  roundRect(ctx, 5, 5, width - 10, height - 10, 12);
  ctx.stroke();

  const pad = 16;
  const innerX = pad;
  const innerW = width - pad * 2;

  roundRect(ctx, innerX, pad, innerW, 48, 10);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (logoImage) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(innerX + 28, pad + 24, 18, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(logoImage, innerX + 10, pad + 6, 36, 36);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(innerX + 28, pad + 24, 18, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "700 20px Inter, system-ui, sans-serif";
  ctx.fillText("TLOB", innerX + 54, pad + 8);
  ctx.font = "700 18px Inter, system-ui, sans-serif";
  ctx.fillText("Member ID", innerX + 54, pad + 28);

  const boxY = pad + 60;
  const boxH = 350;
  roundRect(ctx, innerX, boxY, innerW, boxH, 12);
  ctx.fillStyle = "#f9fafb";
  ctx.fill();
  ctx.strokeStyle = "#144dbe";
  ctx.lineWidth = 3;
  ctx.stroke();
  const qrSize = 330;
  ctx.drawImage(qrImage, innerX + (innerW - qrSize) / 2, boxY + (boxH - qrSize) / 2, qrSize, qrSize);

  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "700 26px Inter, system-ui, sans-serif";
  const nameY = boxY + boxH + 10;
  ctx.fillText(String(member.name || ""), width / 2, nameY, innerW);

  const badgeY = nameY + 34;
  ctx.font = "600 16px Inter, system-ui, sans-serif";
  const idText = String(member.id || "");
  const statusText = `  ${member.status || "Active"}`;
  const idW = Math.ceil(ctx.measureText(idText).width) + 16;
  const statusW = Math.ceil(ctx.measureText(statusText).width) + 28;
  const totalW = idW + 8 + statusW;
  let badgeX = (width - totalW) / 2;
  badgeX += drawBadge(ctx, idText, badgeX, badgeY, "#f3f4f6", "#374151", "#d1d5db") + 8;
  roundRect(ctx, badgeX, badgeY, statusW, 22, 4);
  ctx.fillStyle = "#e0f2fe";
  ctx.fill();
  ctx.strokeStyle = "#06b6d4";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#10b981";
  ctx.beginPath();
  ctx.arc(badgeX + 10, badgeY + 11, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0369a1";
  ctx.font = "600 16px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(String(member.status || "Active"), badgeX + 18, badgeY + 12);

  ctx.strokeStyle = "#5d5f64";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, height - 42);
  ctx.lineTo(innerX + innerW, height - 42);
  ctx.stroke();
  ctx.fillStyle = "#666666";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = "600 14px Inter, system-ui, sans-serif";
  ctx.fillText("Gamitin sa iyong weekly attendance. Huwag iwawala.", width / 2, height - 34, innerW);

  return canvas.toDataURL("image/jpeg", 0.95);
}
