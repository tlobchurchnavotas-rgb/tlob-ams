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

function weekKey(date) {
  const weekStart = new Date(date);
  const day = weekStart.getDay();
  const daysSinceMonday = (day + 6) % 7;
  weekStart.setDate(weekStart.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart.getTime();
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
    const recoveryEventsByWeek = new Map();
    records
      .filter((record) => record.date > recoveryStart)
      .forEach((record) => {
        const week = weekKey(record.date);
        const eventsInWeek = recoveryEventsByWeek.get(week) || new Set();
        eventsInWeek.add(record.eventId || record.date.toISOString());
        recoveryEventsByWeek.set(week, eventsInWeek);
      });
    const attendedWeeks = Array.from(recoveryEventsByWeek.keys()).sort((first, second) => first - second);
    const hasConsecutiveWeeks = attendedWeeks.some((week, index) => (
      index > 0 && week - attendedWeeks[index - 1] === 7 * 24 * 60 * 60 * 1000
    ));
    return hasConsecutiveWeeks
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