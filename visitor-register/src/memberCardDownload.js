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
    },
  });
  return canvasToBlob(rendered, "image/png");
}

export async function saveImageBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type || "image/png" });

  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
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
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
}
