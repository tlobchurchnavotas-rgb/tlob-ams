import { recordAuditLog } from "../auditLogs.js";

export function nextPrefixedId(list, prefix) {
  const nums = (list || [])
    .map((item) => parseInt(String(item?.id || "").slice(prefix.length), 10))
    .filter((n) => !Number.isNaN(n));
  return `${prefix}${String(nums.length > 0 ? Math.max(...nums) + 1 : 1).padStart(3, "0")}`;
}

export function memberQrPayload(member) {
  if (!member?.id) return "";
  return `TLOB:${member.id}:${member.name || ""}`;
}

export function uniqueVisitorEventCount(attendance, visitorId, extraEventId) {
  const ids = new Set();
  for (const row of attendance || []) {
    if (row?.visitorId === visitorId && row.eventId) ids.add(row.eventId);
  }
  if (extraEventId) ids.add(extraEventId);
  return ids.size;
}

export function parseAutoConvertThreshold(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

export function shouldAutoConvertVisitor({ visitor, attendance, threshold, extraEventId }) {
  if (!visitor || visitor.convertedToMember) return false;
  const n = parseAutoConvertThreshold(threshold);
  if (n <= 0) return false;
  return uniqueVisitorEventCount(attendance, visitor.id, extraEventId) >= n;
}

export function buildMemberFromVisitor(visitor, members) {
  return {
    id: nextPrefixedId(members, "M"),
    name: visitor.name,
    contact: visitor.contact,
    ministry: "",
    status: "Active",
    joined: visitor.date,
    sourceEventId: visitor.eventId || "",
    photo: null,
    archived: false,
    birthday: "",
    anniversary: "",
  };
}

export function remapVisitorAttendance(attendance, visitorId, member) {
  return (attendance || []).map((record) => (
    record.visitorId === visitorId
      ? { ...record, memberId: member.id, visitorId: null, memberName: member.name }
      : record
  ));
}

export function applyVisitorConversion(visitor, members, attendance) {
  if (!visitor || visitor.convertedToMember) return null;
  const member = buildMemberFromVisitor(visitor, members);
  return {
    member,
    members: [...(members || []), member],
    attendance: remapVisitorAttendance(attendance, visitor.id, member),
  };
}

export async function convertVisitorToMember({
  visitor,
  members,
  attendance,
  setMembers,
  setAttendance,
  setVisitors,
  actor,
  source = "visitors",
}) {
  const result = applyVisitorConversion(visitor, members, attendance);
  if (!result) return null;
  setMembers(result.members);
  setAttendance(result.attendance);
  setVisitors((prev) => (prev || []).map((row) => (
    row.id === visitor.id ? { ...row, convertedToMember: true } : row
  )));
  try {
    await recordAuditLog({
      actor,
      action: "visitor_converted_to_member",
      target: result.member.id,
      source,
      metadata: { visitorId: visitor.id, memberId: result.member.id, name: visitor.name },
    });
  } catch {}
  return result.member;
}

export function encodeClaimPayload({ memberId, name }) {
  const json = JSON.stringify({ memberId, name });
  const bytes = typeof TextEncoder !== "undefined"
    ? new TextEncoder().encode(json)
    : Array.from(unescape(encodeURIComponent(json))).map((ch) => ch.charCodeAt(0));
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

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

export function buildClaimUrl(baseUrl, member) {
  const encoded = encodeClaimPayload({ memberId: member.id, name: member.name });
  const origin = String(baseUrl || "").trim().replace(/\/$/, "");
  if (!origin || origin.startsWith("file:")) return `#claim=${encoded}`;
  return `${origin}/#claim=${encoded}`;
}
