const MONTHS = 2;

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function subtractMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

function attendanceForMember(member, attendance) {
  return (attendance || [])
    .filter((record) => record.memberId === member.id)
    .map((record) => ({ ...record, date: validDate(record.timestamp) }))
    .filter((record) => record.date)
    .sort((first, second) => second.date - first.date);
}

export function getMemberActivityUpdate(member, attendance, now = new Date()) {
  if (!member || member.archived) return null;

  const records = attendanceForMember(member, attendance);
  const lastAttendance = records[0]?.date || null;
  const joined = validDate(member.joined);
  const created = validDate(member.createdAt);
  const referenceDate = lastAttendance || joined || created;
  const inactiveAt = validDate(member.inactiveSince) || referenceDate;
  const twoMonthsAgo = subtractMonths(now, MONTHS);

  if (member.status === "Inactive") {
    const recoveryStart = validDate(member.inactiveSince);
    if (!recoveryStart) return null;
    const recoveryEvents = new Set(
      records
        .filter((record) => !recoveryStart || record.date > recoveryStart)
        .map((record) => record.eventId || record.date.toISOString())
    );
    return recoveryEvents.size >= 2
      ? { status: "Active", inactiveSince: null }
      : null;
  }

  if (member.status === "Active" && inactiveAt && inactiveAt < twoMonthsAgo) {
    return { status: "Inactive", inactiveSince: inactiveAt.toISOString() };
  }

  return null;
}

export function reconcileMemberActivity(members, attendance, now = new Date()) {
  let changed = false;
  const nextMembers = (members || []).map((member) => {
    const update = getMemberActivityUpdate(member, attendance, now);
    if (!update) return member;
    changed = true;
    return { ...member, ...update };
  });
  return changed ? nextMembers : members;
}