/** App role names (must match `profiles.role` in Supabase). */
export const ROLES = Object.freeze({
  ADMIN: "Admin",
  PASTOR: "Pastor",
  USHER: "Usher",
});

/** Admin and Pastor may open Account Management and manage staff profiles. */
export function canManageAccounts(role) {
  return role === ROLES.ADMIN || role === ROLES.PASTOR;
}

/** Operational UI (members archive/import, event admin actions, reports, settings) — all staff except none; keeps one place to extend later. */
export function canManageChurchData(role) {
  return role === ROLES.ADMIN || role === ROLES.PASTOR || role === ROLES.USHER;
}

/** Analytics / reports / settings sidebar — everyone except blocked roles (none today). */
export function canAccessStaffFeatures(role) {
  return role === ROLES.ADMIN || role === ROLES.PASTOR || role === ROLES.USHER;
}
