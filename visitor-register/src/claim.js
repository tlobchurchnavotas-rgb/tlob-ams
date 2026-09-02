export function decodeClaimPayload(raw) {
  if (!raw) return null;
  try {
    const padded = String(raw).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(raw).length + 3) % 4);
    const bin = atob(padded);
    let json = "";
    if (typeof TextDecoder !== "undefined") {
      json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    } else {
      json = decodeURIComponent(escape(bin));
    }
    const data = JSON.parse(json);
    if (!data?.memberId || !data?.name) return null;
    return { memberId: String(data.memberId), name: String(data.name) };
  } catch {
    return null;
  }
}

export function claimFromLocation() {
  try {
    const hash = window.location.hash || "";
    const hashMatch = hash.match(/claim=([^&]+)/);
    if (hashMatch?.[1]) return decodeClaimPayload(decodeURIComponent(hashMatch[1]));
    const query = new URLSearchParams(window.location.search).get("claim");
    if (query) return decodeClaimPayload(query);
  } catch {}
  return null;
}

export function memberQrPayload(memberId, name) {
  return `TLOB:${memberId}:${name || ""}`;
}
