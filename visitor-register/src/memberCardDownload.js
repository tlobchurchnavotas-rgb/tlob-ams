import html2canvas from "html2canvas";

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

export function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create the ID card image."));
      },
      type,
      quality,
    );
  });
}

export async function captureCardPng(cardEl) {
  if (!cardEl) throw new Error("Card is not ready yet.");
  const rendered = await html2canvas(cardEl, {
    width: 250,
    height: 310,
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    allowTaint: true,
    logging: false,
    onclone: (_doc, clone) => {
      clone.style.colorScheme = "only light";
      clone.style.background = "#ffffff";
      clone.style.transform = "none";
      clone.style.position = "static";
      clone.style.left = "auto";
      clone.style.top = "auto";
    },
  });
  return canvasToBlob(rendered, "image/png");
}

export function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/i.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(blob);
  });
}

function triggerAnchorDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}

export async function saveImageBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });

  // iOS ignores <a download> for blobs. The share sheet is where "Save Image" appears.
  if (isIosDevice() && canShareFiles) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }

  // Android/desktop: a real file download. Do not use Web Share first — that
  // opens a share sheet with no "Save image" / gallery option.
  triggerAnchorDownload(blob, filename);
}
