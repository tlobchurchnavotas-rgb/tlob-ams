import { supabase } from "./supabaseClient.js";

const MIGRATION_FLAG_KEY = "tlob_migration_real_tables_v1_done";

async function getKv(ownerId, key) {
  const { data, error } = await supabase
    .from("app_kv")
    .select("value")
    .eq("owner_id", ownerId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data?.value ?? null;
}

async function setKv(ownerId, key, value) {
  const { error } = await supabase
    .from("app_kv")
    .upsert({ owner_id: ownerId, key, value }, { onConflict: "owner_id,key" });
  if (error) throw error;
}

async function tableHasAnyRows(ownerId, table) {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("owner_id", ownerId)
    .limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

async function insertAll(ownerId, table, rows) {
  if (!rows.length) return;
  const payload = rows.map((r) => ({ owner_id: ownerId, ...r }));
  const { error } = await supabase.from(table).insert(payload);
  if (error) throw error;
}

export async function migrateKvToRealTablesIfNeeded(ownerId) {
  if (!supabase) return;
  if (!ownerId) return;

  // Skip if already migrated
  const alreadyDone = await getKv(ownerId, MIGRATION_FLAG_KEY);
  if (alreadyDone === true) return;

  // Only migrate if destination tables are empty, to avoid overwriting real data.
  const [membersAny, eventsAny, attendanceAny, visitorsAny] = await Promise.all([
    tableHasAnyRows(ownerId, "members"),
    tableHasAnyRows(ownerId, "events"),
    tableHasAnyRows(ownerId, "attendance"),
    tableHasAnyRows(ownerId, "visitors"),
  ]);
  if (membersAny || eventsAny || attendanceAny || visitorsAny) {
    await setKv(ownerId, MIGRATION_FLAG_KEY, true);
    return;
  }

  // Pull old datasets from KV (if present)
  const [members, events, attendance, visitors] = await Promise.all([
    getKv(ownerId, "tlob_members"),
    getKv(ownerId, "tlob_events"),
    getKv(ownerId, "tlob_attendance"),
    getKv(ownerId, "tlob_visitors"),
  ]);

  const m = Array.isArray(members) ? members : [];
  const e = Array.isArray(events) ? events : [];
  const a = Array.isArray(attendance) ? attendance : [];
  const v = Array.isArray(visitors) ? visitors : [];

  // Insert into real tables
  await insertAll(ownerId, "members", m);
  await insertAll(ownerId, "events", e);
  await insertAll(ownerId, "attendance", a);
  await insertAll(ownerId, "visitors", v);

  // Mark done
  await setKv(ownerId, MIGRATION_FLAG_KEY, true);
}

