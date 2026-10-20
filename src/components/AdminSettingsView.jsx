import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { Icon } from "./Icon.jsx";
import { recordAuditLog } from "../auditLogs.js";
import { usePersisted } from "../constants.js";
import { QRCode } from "../utils/qr.js";
import packageJson from "../../package.json";
import JSZip from "jszip";
import { canManageAccounts } from "../roles.js";
import { preparePhoto } from "../utils/preparePhoto.js";

const BACKUP_PAGE_SIZE = 1000;

async function fetchAllRows(queryForPage, label) {
  const rows = [];
  for (let from = 0; ; from += BACKUP_PAGE_SIZE) {
    const { data, error } = await queryForPage().range(from, from + BACKUP_PAGE_SIZE - 1);
    if (error) throw new Error(`Could not back up ${label}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < BACKUP_PAGE_SIZE) return rows;
  }
}

function csvCell(value) {
  const text = value != null && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function rowsToCsv(rows) {
  const columns = [...new Set((rows || []).flatMap((row) => Object.keys(row || {})))];
  if (!columns.length) return "";
  return [columns.map(csvCell).join(","), ...(rows || []).map((row) => columns.map((key) => csvCell(row?.[key])).join(","))].join("\r\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("The CSV backup contains an unterminated quoted field.");
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  if (!rows.length) return [];

  const headers = rows.shift().map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error("The CSV backup contains an empty column name.");
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function parseCsvDataset(text, name) {
  return parseCsv(text).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    if (value === "") return [key, null];
    if (key === "value" || /^[{[]/.test(value)) {
      try { return [key, JSON.parse(value)]; } catch {}
    }
    if (["archived", "converted_to_member", "member_card_qr"].includes(key)) {
      if (value === "true") return [key, true];
      if (value === "false") return [key, false];
    }
    return [key, value];
  }))).filter((row) => Object.keys(row).length > 0 && (name === "settings" || Object.values(row).some((value) => value != null)));
}

function normalizeBackupRows(rows, dataset) {
  if (!Array.isArray(rows)) throw new Error(`Backup dataset "${dataset}" must be an array.`);
  return rows.map((source, index) => {
    if (!source || typeof source !== "object" || Array.isArray(source) || !source.id) {
      throw new Error(`Backup dataset "${dataset}" has an invalid row at position ${index + 1}.`);
    }
    const row = { ...source };
    delete row.owner_id;
    delete row.updated_at;
    if (dataset === "members") {
      if (row.created_at !== undefined) { row.createdAt = row.created_at; delete row.created_at; }
      if (row.age_group !== undefined) { row.ageGroup = row.age_group; delete row.age_group; }
      if (row.source_event_id !== undefined) { row.sourceEventId = row.source_event_id; delete row.source_event_id; }
      if (row.inactive_since !== undefined) { row.inactiveSince = row.inactive_since; delete row.inactive_since; }
    }
    if (dataset === "attendance") {
      if (row.member_id !== undefined) { row.memberId = row.member_id; delete row.member_id; }
      if (row.visitor_id !== undefined) { row.visitorId = row.visitor_id; delete row.visitor_id; }
      if (row.event_id !== undefined) { row.eventId = row.event_id; delete row.event_id; }
      if (row.member_name !== undefined) { row.memberName = row.member_name; delete row.member_name; }
      if (row.member_card_qr !== undefined) { row.memberCardQr = row.member_card_qr; delete row.member_card_qr; }
    }
    if (dataset === "visitors") {
      if (row.event_id !== undefined) { row.eventId = row.event_id; delete row.event_id; }
      if (row.invited_by !== undefined) { row.invitedBy = row.invited_by; delete row.invited_by; }
      if (row.converted_to_member !== undefined) { row.convertedToMember = row.converted_to_member; delete row.converted_to_member; }
    }
    return row;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function deriveUsernameFromEmail(email) {
  const raw = (email || "").split("@")[0] || "";
  return raw.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32);
}

function loadLocalProfile(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(`tlob_profile_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalProfile(userId, profile) {
  if (!userId) return;
  try {
    localStorage.setItem(`tlob_profile_${userId}`, JSON.stringify(profile));
  } catch {}
}

export default function AdminSettingsView({ theme, darkMode, setDarkMode, showNotif, currentUser, setCurrentUser, completionPin, setCompletionPin, events = [], members = [], attendance = [], visitors = [], setMembers, setEvents, setAttendance, setVisitors, backupReady = false }) {
  const userId = currentUser?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", avatarUrl: "" });
  const [pinInput, setPinInput] = useState(completionPin || "");
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadingUpdate, setDownloadingUpdate] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [resettingData, setResettingData] = useState(false);
  const fileInputRef = useRef(null);
  const jsonBackupInputRef = useRef(null);
  const csvBackupInputRef = useRef(null);
  const [publicRegisterEnabled, setPublicRegisterEnabled] = usePersisted("public_register_enabled", true, userId);
  const [publicRegisterBaseUrl, setPublicRegisterBaseUrl] = usePersisted("public_register_base_url", "", userId);
  const [autoConvertAfterVisits, setAutoConvertAfterVisits] = usePersisted("auto_convert_after_visits", 2, userId);
  const [registerEventId, setRegisterEventId] = useState("");

  const canUseDb = useMemo(() => Boolean(isSupabaseConfigured && supabase && userId), [userId]);
  const openEvents = useMemo(
    () => (events || []).filter((e) => e.status === "Active" || e.status === "Upcoming"),
    [events],
  );
  const publicRegisterUrl = useMemo(() => {
    const origin = String(publicRegisterBaseUrl || "").trim().replace(/\/$/, "");
    if (!origin || origin.startsWith("file:")) return "";
    const qs = registerEventId ? `?event=${encodeURIComponent(registerEventId)}` : "";
    return `${origin}${qs}`;
  }, [publicRegisterBaseUrl, registerEventId]);

  useEffect(() => {
    setPinInput(completionPin || "");
  }, [completionPin]);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      setLoading(true);
      try {
        if (canUseDb) {
          const { data, error } = await supabase
            .from("profiles")
            .select("name,username,avatar_url")
            .eq("id", userId)
            .maybeSingle();
          if (error) throw error;
          const next = {
            name: data?.name ?? currentUser?.name ?? "",
            username: data?.username ?? currentUser?.username ?? deriveUsernameFromEmail(currentUser?.email),
            avatarUrl: data?.avatar_url ?? currentUser?.avatarUrl ?? "",
          };
          if (!cancelled) setForm(next);
        } else {
          const local = loadLocalProfile(userId);
          const next = {
            name: local?.name ?? currentUser?.name ?? "",
            username: local?.username ?? currentUser?.username ?? deriveUsernameFromEmail(currentUser?.email),
            avatarUrl: local?.avatarUrl ?? currentUser?.avatarUrl ?? "",
          };
          if (!cancelled) setForm(next);
        }
      } catch {
        if (!cancelled) {
          setForm({
            name: currentUser?.name ?? "",
            username: currentUser?.username ?? deriveUsernameFromEmail(currentUser?.email),
            avatarUrl: currentUser?.avatarUrl ?? "",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [canUseDb, currentUser?.email, currentUser?.name, currentUser?.avatarUrl, currentUser?.username, userId]);

  const pickFile = () => fileInputRef.current?.click?.();

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      showNotif("Please select an image file.", "error");
      return;
    }
    try {
      const dataUrl = await preparePhoto(file, { size: 160, quality: 0.82 });
      setForm((f) => ({ ...f, avatarUrl: dataUrl }));
    } catch {
      showNotif("Could not read image file.", "error");
    }
  };

  const validate = () => {
    if (!form.name?.trim()) return "Name is required.";
    if (!form.username?.trim()) return "Username is required.";
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(form.username.trim())) {
      return "Username must be 3–32 characters (letters, numbers, dot, underscore, dash).";
    }
    if (form.avatarUrl && !/^https?:\/\//i.test(form.avatarUrl) && !form.avatarUrl.startsWith("data:image/")) {
      return "Profile picture must be a valid URL or uploaded image.";
    }
    if (!/^\d{6}$/.test(pinInput)) return "Completion PIN must contain exactly 6 digits.";
    return null;
  };

  const checkForUpdates = async () => {
    if (!window.tlob?.checkForUpdates) {
      showNotif("Updates not available in this environment.", "info");
      return;
    }

    setCheckingUpdates(true);
    try {
      const result = await window.tlob.checkForUpdates();
      if (result?.error) throw new Error(result.error);
      if (result?.updateAvailable) {
        setUpdateAvailable(true);
        setUpdateInfo(result.updateInfo);
        showNotif(`Update available! Version ${result.updateInfo?.version || "unknown"}. Click Download to get it.`, "success");
      } else {
        setUpdateAvailable(false);
        setUpdateInfo(null);
        showNotif(`You're already using the latest version (${result?.currentVersion || "current"}).`, "info");
      }
    } catch (error) {
      showNotif(`Error checking for updates: ${error?.message || "Unknown error"}`, "error");
    } finally {
      setCheckingUpdates(false);
    }
  };

  const downloadUpdate = async () => {
    if (!window.tlob?.downloadUpdate) {
      showNotif("Download not available in this environment.", "error");
      return;
    }

    setDownloadingUpdate(true);
    try {
      const result = await window.tlob.downloadUpdate();
      if (!result?.success) throw new Error(result?.error || "Unknown download error");
      showNotif("Update downloaded! Restart the app to install.", "success");
    } catch (error) {
      showNotif(`Error downloading update: ${error?.message || "Unknown error"}`, "error");
    } finally {
      setDownloadingUpdate(false);
    }
  };

  const buildBackup = async () => {
    const includeAuditLogs = canManageAccounts(currentUser?.role);
    let datasets;
    let settings;
    let profile;
    let auditLogs = [];

    if (canUseDb) {
      const ownedRows = (table) => fetchAllRows(
        () => supabase.from(table).select("*").eq("owner_id", userId),
        table,
      );
      const [backupMembers, backupEvents, backupAttendance, backupVisitors, profileResult, settingRows] = await Promise.all([
        ownedRows("members"),
        ownedRows("events"),
        ownedRows("attendance"),
        ownedRows("visitors"),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        fetchAllRows(
          () => supabase.from("app_kv").select("key,value").eq("owner_id", userId),
          "settings",
        ),
      ]);
      if (profileResult.error) throw new Error(`Could not back up profile: ${profileResult.error.message}`);
      datasets = { members: backupMembers, events: backupEvents, attendance: backupAttendance, visitors: backupVisitors };
      settings = Object.fromEntries((settingRows || []).map(({ key, value }) => [key, value]));
      profile = profileResult.data || null;
      if (includeAuditLogs) {
        auditLogs = await fetchAllRows(
          () => supabase.from("audit_logs").select("*").order("created_at", { ascending: true }),
          "audit logs",
        );
      }
    } else {
      datasets = { members, events, attendance, visitors };
      const settingKeys = ["darkMode", "completion_pin", "public_register_enabled", "public_register_base_url", "auto_convert_after_visits", "event_templates"];
      settings = {};
      settingKeys.forEach((key) => {
        try {
          const raw = localStorage.getItem(`tlob_${key}`);
          if (raw != null) settings[`tlob_${key}`] = JSON.parse(raw);
        } catch {}
      });
      try {
        const localProfile = localStorage.getItem(`tlob_profile_${userId}`);
        profile = localProfile ? { ...currentUser, ...JSON.parse(localProfile) } : currentUser;
      } catch {
        profile = currentUser;
      }
      if (includeAuditLogs) {
        try {
          const raw = localStorage.getItem("tlob_audit_logs");
          const parsed = raw ? JSON.parse(raw) : [];
          auditLogs = Array.isArray(parsed) ? parsed : [];
        } catch {
          auditLogs = [];
        }
      }
    }

    settings = {
      ...settings,
      tlob_darkMode: Boolean(darkMode),
      tlob_completion_pin: completionPin,
      tlob_public_register_enabled: publicRegisterEnabled,
      tlob_public_register_base_url: publicRegisterBaseUrl,
      tlob_auto_convert_after_visits: autoConvertAfterVisits,
    };

    return {
      format: "tlob-ams-backup",
      version: 1,
      generatedAt: new Date().toISOString(),
      applicationVersion: packageJson.version,
      account: { id: userId, email: currentUser?.email || "" },
      included: { auditLogs: includeAuditLogs },
      data: { ...datasets, profile: profile ? [profile] : [], settings, auditLogs },
    };
  };

  const downloadJsonBackup = async () => {
    if (!backupReady || creatingBackup) return;
    setCreatingBackup(true);
    try {
      const backup = await buildBackup();
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" }), `tlob-ams-backup-${date}.json`);
      showNotif("JSON backup downloaded.");
    } catch (error) {
      showNotif(error?.message || "Could not create backup.", "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const downloadCsvBackup = async () => {
    if (!backupReady || creatingBackup) return;
    setCreatingBackup(true);
    try {
      const backup = await buildBackup();
      const zip = new JSZip();
      const { data } = backup;
      ["members", "events", "attendance", "visitors", "profile", "auditLogs"].forEach((key) => {
        if (key !== "auditLogs" || backup.included.auditLogs) {
          zip.file(`${key}.csv`, `\uFEFF${rowsToCsv(data[key])}`);
        }
      });
      zip.file("settings.csv", `\uFEFF${rowsToCsv(Object.entries(data.settings).map(([key, value]) => ({ key, value })))}`);
      zip.file("README.txt", `TLOB AMS CSV backup\r\nGenerated: ${backup.generatedAt}\r\nApplication version: ${backup.applicationVersion}\r\nAudit logs included: ${backup.included.auditLogs ? "yes" : "no (current role does not have audit-log access)"}\r\nEach CSV file contains one dataset. JSON-valued cells are encoded as JSON text.\r\n`);
      const blob = await zip.generateAsync({ type: "blob", mimeType: "application/zip" });
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `tlob-ams-csv-backup-${date}.zip`);
      showNotif("CSV backup downloaded.");
    } catch (error) {
      showNotif(error?.message || "Could not create backup.", "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  const resetOwnData = async (includeMembers) => {
    if (!backupReady || resettingData || creatingBackup) return;
    const confirmed = window.prompt(
      `This permanently deletes events, attendance, visitors, saved settings, and your audit history for ${currentUser?.email || "this account"}.${includeMembers ? " Member records will also be deleted." : " Member records will be kept."} Your profile and sign-in account will remain.\n\nType RESET to continue.`,
    );
    if (confirmed !== "RESET") return;

    setResettingData(true);
    try {
      if (canUseDb) {
        const { error } = await supabase.rpc("reset_own_ams_data", { p_include_members: includeMembers });
        if (error) {
          if (error.code === "PGRST202" || /reset_own_ams_data/i.test(error.message || "")) {
            throw new Error("Reset options are not configured on the server yet. Run the updated supabase/reset_own_ams_data.sql in the Supabase SQL Editor, then try again.");
          }
          throw new Error(error.message || "The account data reset failed.");
        }
      } else {
        for (let index = localStorage.length - 1; index >= 0; index -= 1) {
          const key = localStorage.key(index);
          if (!key?.startsWith("tlob_") || key === `tlob_profile_${userId}` || key === "tlob_local_reset_scope" || key === "tlob_local_reset_members" || key === "tlob_audit_logs") continue;
          localStorage.removeItem(key);
        }
        localStorage.setItem("tlob_local_reset_scope", includeMembers ? "all" : "keep-members");
        if (includeMembers) {
          localStorage.removeItem("tlob_local_reset_members");
        } else {
          localStorage.setItem("tlob_local_reset_members", JSON.stringify(members));
        }
        try {
          const rawLogs = localStorage.getItem("tlob_audit_logs");
          const logs = rawLogs ? JSON.parse(rawLogs) : [];
          if (Array.isArray(logs) && userId) {
            localStorage.setItem("tlob_audit_logs", JSON.stringify(logs.filter((entry) => entry?.actor_id !== userId)));
          }
        } catch {}
      }

      if (includeMembers) setMembers([]);
      setEvents([]);
      setAttendance([]);
      setVisitors([]);
      setDarkMode(true);
      setCompletionPin("123456");
      setPublicRegisterEnabled(true);
      setPublicRegisterBaseUrl("");
      setAutoConvertAfterVisits(2);
      showNotif(includeMembers
        ? "All AMS data, including member records, has been reset. Your profile and account were kept."
        : "AMS data has been reset. Member records, profile, and account were kept.");
    } catch (error) {
      showNotif(error?.message || "Could not reset account data.", "error");
    } finally {
      setResettingData(false);
    }
  };

  const readBackupFile = async (file) => {
    const extension = file.name.toLowerCase().split(".").pop();
    if (extension === "json") {
      const backup = JSON.parse(await file.text());
      if (backup?.format !== "tlob-ams-backup" || backup?.version !== 1 || !backup.data) {
        throw new Error("This JSON file is not a supported TLOB AMS backup.");
      }
      return backup;
    }
    if (extension !== "zip") throw new Error("Choose a TLOB AMS JSON backup or CSV backup ZIP file.");

    const zip = await JSZip.loadAsync(file);
    const names = ["members", "events", "attendance", "visitors"];
    const datasets = {};
    for (const name of names) {
      const entry = zip.file(`${name}.csv`);
      if (!entry) throw new Error(`The CSV backup is missing ${name}.csv.`);
      datasets[name] = parseCsvDataset(await entry.async("text"), name);
    }
    for (const name of ["profile", "auditLogs"]) {
      const entry = zip.file(`${name}.csv`);
      datasets[name] = entry ? parseCsvDataset(await entry.async("text"), name) : [];
    }
    const settingsFile = zip.file("settings.csv");
    if (!settingsFile) throw new Error("The CSV backup is missing settings.csv.");
    const settingRows = parseCsvDataset(await settingsFile.async("text"), "settings");
    const settings = Object.fromEntries(settingRows.filter((row) => row.key).map((row) => [row.key, row.value]));
    return { format: "tlob-ams-backup", version: 1, included: { auditLogs: Boolean(zip.file("auditLogs.csv")) }, data: { ...datasets, settings } };
  };

  const importBackup = async (event, expectedFormat) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = file.name.toLowerCase().split(".").pop();
    const expectedExtension = expectedFormat === "json" ? "json" : "zip";
    if (extension !== expectedExtension) {
      showNotif(expectedFormat === "json" ? "Choose a JSON backup file." : "Choose a CSV backup ZIP file.", "error");
      return;
    }
    if (!backupReady || creatingBackup) {
      showNotif("Wait for app data to finish loading before importing a backup.", "warning");
      return;
    }

    setCreatingBackup(true);
    try {
      const backup = await readBackupFile(file);
      const requiredDatasets = ["members", "events", "attendance", "visitors"];
      const restored = Object.fromEntries(requiredDatasets.map((name) => [name, normalizeBackupRows(backup.data?.[name], name)]));
      const settings = backup.data?.settings;
      if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        throw new Error("The backup settings section is missing or invalid.");
      }
      const profile = Array.isArray(backup.data?.profile) ? backup.data.profile[0] : null;
      if (profile && typeof profile !== "object") throw new Error("The backup profile is invalid.");
      const canRestoreAuditLogs = canManageAccounts(currentUser?.role) && backup.included?.auditLogs && Array.isArray(backup.data?.auditLogs);
      const summary = requiredDatasets.map((name) => `${restored[name].length} ${name}`).join(", ");
      const confirmed = window.confirm(`Restore this TLOB AMS backup? Current members, events, attendance, visitors, and saved settings will be replaced.\n\n${summary}${canRestoreAuditLogs ? `\n${backup.data.auditLogs.length} audit log records will be added if not already present.` : ""}\n\nThis cannot be undone.`);
      if (!confirmed) return;

      setMembers(restored.members);
      setEvents(restored.events);
      setAttendance(restored.attendance);
      setVisitors(restored.visitors);

      const settingValue = (key) => settings[`tlob_${key}`] ?? settings[key];
      const restoredDarkMode = settingValue("darkMode");
      const restoredPin = settingValue("completion_pin");
      const restoredRegisterEnabled = settingValue("public_register_enabled");
      const restoredRegisterUrl = settingValue("public_register_base_url");
      const restoredAutoConvert = settingValue("auto_convert_after_visits");
      if (typeof restoredDarkMode === "boolean") setDarkMode(restoredDarkMode);
      if (restoredPin != null) setCompletionPin(String(restoredPin));
      if (restoredRegisterEnabled != null) setPublicRegisterEnabled(Boolean(restoredRegisterEnabled));
      if (restoredRegisterUrl != null) setPublicRegisterBaseUrl(String(restoredRegisterUrl));
      if (restoredAutoConvert != null) setAutoConvertAfterVisits(Number(restoredAutoConvert));

      if (canUseDb) {
        const appSettings = Object.entries(settings).map(([key, value]) => ({ owner_id: userId, key, value }));
        if (appSettings.length) {
          const { error } = await supabase.from("app_kv").upsert(appSettings, { onConflict: "owner_id,key" });
          if (error) throw new Error(`Data restored, but saved settings could not be written: ${error.message}`);
        }
        if (profile) {
          const profilePayload = {
            name: profile.name,
            username: profile.username,
            avatar_url: profile.avatar_url ?? profile.avatarUrl ?? null,
          };
          const { error } = await supabase.from("profiles").update(profilePayload).eq("id", userId);
          if (error) throw new Error(`Data restored, but profile could not be written: ${error.message}`);
          setForm({ name: profilePayload.name || "", username: profilePayload.username || "", avatarUrl: profilePayload.avatar_url || "" });
          setCurrentUser((user) => user ? { ...user, name: profilePayload.name || user.name, username: profilePayload.username || user.username, avatarUrl: profilePayload.avatar_url || "" } : user);
        }
        if (canRestoreAuditLogs && backup.data.auditLogs.length) {
          const { data: existing, error: existingError } = await supabase.from("audit_logs").select("id");
          if (existingError) throw new Error(`Data restored, but audit logs could not be checked: ${existingError.message}`);
          const existingIds = new Set((existing || []).map((row) => row.id));
          const newLogs = backup.data.auditLogs.filter((row) => row?.id && !existingIds.has(row.id));
          for (let index = 0; index < newLogs.length; index += 500) {
            const { error } = await supabase.from("audit_logs").insert(newLogs.slice(index, index + 500));
            if (error) throw new Error(`Data restored, but audit logs could not be imported: ${error.message}`);
          }
        }
      } else {
        Object.entries(settings).forEach(([key, value]) => {
          try { localStorage.setItem(key.startsWith("tlob_") ? key : `tlob_${key}`, JSON.stringify(value)); } catch {}
        });
        if (profile) {
          const avatarUrl = profile.avatarUrl ?? profile.avatar_url ?? "";
          const localProfile = { name: profile.name || "", username: profile.username || "", avatarUrl };
          saveLocalProfile(userId, localProfile);
          setForm(localProfile);
          setCurrentUser((user) => user ? { ...user, ...localProfile } : user);
        }
        if (canRestoreAuditLogs) {
          try { localStorage.setItem("tlob_audit_logs", JSON.stringify(backup.data.auditLogs)); } catch {}
        }
      }
      showNotif("Backup restored. Core data will sync to storage.");
    } catch (error) {
      showNotif(error?.message || "Could not import backup.", "error");
    } finally {
      setCreatingBackup(false);
    }
  };

  // Setup update event listeners
  useEffect(() => {
    const handleUpdateAvailable = (info) => {
      showNotif(`Update available: ${info.version}. Click Download to get it.`, "info");
    };

    const handleUpdateDownloaded = (info) => {
      showNotif(`Update ready to install. Restart the app to apply it.`, "success");
    };

    const handleUpdateError = (error) => {
      showNotif(`Update error: ${error}`, "error");
    };

    if (window.tlob?.onUpdateAvailable) {
      window.tlob.onUpdateAvailable(handleUpdateAvailable);
      window.tlob.onUpdateDownloaded(handleUpdateDownloaded);
      window.tlob.onUpdateError(handleUpdateError);
    }

    return () => {
      // Cleanup listeners if needed
    };
  }, [showNotif]);

  const save = async () => {
    const err = validate();
    if (err) {
      showNotif(err, "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        username: form.username.trim(),
        avatar_url: form.avatarUrl?.trim() || null,
      };

      if (canUseDb) {
        const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
        if (error) throw error;
      } else {
        saveLocalProfile(userId, { name: payload.name, username: payload.username, avatarUrl: payload.avatar_url || "" });
      }

      setCurrentUser((u) => ({
        ...u,
        name: payload.name,
        username: payload.username,
        avatarUrl: payload.avatar_url || "",
      }));
      setCompletionPin(pinInput);
      showNotif("Settings saved");
      try {
        await recordAuditLog({
          actor: currentUser,
          action: "profile_updated",
          target: userId,
          source: "admin_settings",
          metadata: {
            name: payload.name,
            username: payload.username,
            avatarUpdated: Boolean(payload.avatar_url),
          },
        });
      } catch {}
    } catch (e) {
      showNotif(e?.message || "Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  const avatarPreview = form.avatarUrl?.trim() || "";

  return (
    <div className="settings-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gridTemplateAreas: '"header header" "profile public" "application public"', gap: 16, maxWidth: 1180, width: "100%", margin: "0 auto", boxSizing: "border-box", alignItems: "stretch" }}>
      <div className="card" style={{ gridArea: "header", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>Admin Settings</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
              Update your profile details (this affects what appears in the header).
            </div>
          </div>
          <button
            className="btn"
            disabled={loading || saving}
            onClick={save}
            style={{
              background: theme.accent,
              color: "white",
              padding: "9px 14px",
              borderRadius: 10,
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 7,
              opacity: loading ? 0.6 : 1,
            }}
          >
            {saving ? (
              <>
                <span style={{ width: 10, height: 10, borderRadius: 999, border: "2px solid rgba(255,255,255,.55)", borderTopColor: "white", display: "inline-block", animation: "spin 1s linear infinite" }} />
                Saving…
              </>
            ) : (
              <>
                <Icon name="check" size={16} /> Save
              </>
            )}
          </button>
        </div>
      </div>

      <div className="card" style={{ gridArea: "profile", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
        <div className="responsive-form-grid" style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 18, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ width: 120, height: 120, borderRadius: 18, overflow: "hidden", border: `1px solid ${theme.border}`, background: theme.surface2, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#6366f1,#06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 900, fontSize: 24 }}>
                  {(form.name?.trim()?.[0] || currentUser?.name?.[0] || "A").toUpperCase()}
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
            <button className="btn" onClick={pickFile} disabled={loading || saving} style={{ background: theme.surface2, color: theme.text, padding: "8px 10px", borderRadius: 10, fontSize: 12, display: "flex", alignItems: "center", gap: 7, border: `1px solid ${theme.border}` }}>
              <Icon name="upload" size={16} /> Upload picture
            </button>
            <button
              className="btn"
              onClick={() => setForm((f) => ({ ...f, avatarUrl: "" }))}
              disabled={loading || saving || !form.avatarUrl}
              style={{
                background: `${theme.danger}12`,
                color: theme.danger,
                padding: "8px 10px",
                borderRadius: 10,
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: `1px solid ${theme.border}`,
                opacity: !form.avatarUrl ? 0.55 : 1,
              }}
            >
              <Icon name="trash" size={16} /> Remove
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label>Display Name</label>
              <input
                type="text"
                value={form.name}
                disabled={loading || saving}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Admin John"
              />
            </div>

            <div>
              <label>Username</label>
              <input
                type="text"
                value={form.username}
                disabled={loading || saving}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="e.g. admin.john"
              />
              <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
                Allowed: letters, numbers, dot, underscore, dash (3–32 chars).
              </div>
            </div>

            <div>
              <label>Profile picture URL (optional)</label>
              <input
                type="text"
                value={form.avatarUrl}
                disabled={loading || saving}
                onChange={(e) => setForm((f) => ({ ...f, avatarUrl: e.target.value }))}
                placeholder="https://… (or use Upload above)"
              />
            </div>

            <div style={{ padding: "12px 14px", borderRadius: 12, background: theme.surface2, border: `1px solid ${theme.border}` }}>
              <label>Event Completion PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                disabled={loading || saving}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 6-digit PIN"
                aria-describedby="completion-pin-help"
              />
              <div id="completion-pin-help" style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
                Required before completing an event from the Events page or kiosk. Default PIN: 123456.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 12px", borderRadius: 12, background: theme.surface2, border: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted }}>
              <div><b style={{ color: theme.text }}>Account:</b> {currentUser?.email || "—"}</div>
              <div><b style={{ color: theme.text }}>Role:</b> {currentUser?.role || "—"}</div>
              {!canUseDb && <div><b style={{ color: theme.text }}>Storage:</b> Local (Supabase not configured)</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ gridArea: "public", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>Public self-registration</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4, marginBottom: 14 }}>
          Guests can log as visitors and check in from their phone. After enough unique event visits, kiosk can convert them to members automatically. You can still convert anyone manually from Visitors.
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 14 }}>
          <input
            type="checkbox"
            checked={Boolean(publicRegisterEnabled)}
            onChange={(e) => setPublicRegisterEnabled(e.target.checked)}
          />
          <span style={{ fontSize: 13, fontWeight: 600, textTransform: "none", letterSpacing: 0, color: theme.text }}>Enable public registration link</span>
        </label>
        <div style={{ marginBottom: 14 }}>
          <label>Auto-convert after unique event visits</label>
          <input
            type="number"
            min={0}
            step={1}
            value={autoConvertAfterVisits ?? 2}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                setAutoConvertAfterVisits("");
                return;
              }
              const n = Math.max(0, Math.floor(Number(raw) || 0));
              setAutoConvertAfterVisits(n);
            }}
            onBlur={() => {
              if (autoConvertAfterVisits === "" || autoConvertAfterVisits == null) setAutoConvertAfterVisits(2);
            }}
          />
          <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
            Default is 2 (first register + second event). Set to 0 to turn auto-convert off and convert only from Visitors.
          </div>
        </div>
        {publicRegisterEnabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label>Public register app URL (Vercel)</label>
              <input
                type="url"
                value={publicRegisterBaseUrl}
                onChange={(e) => setPublicRegisterBaseUrl(e.target.value)}
                placeholder="https://tlob-register.vercel.app"
              />
              <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>
                Paste the URL of the separate visitor-register app (not the AMS desktop/site).
              </div>
            </div>
            <div>
              <label>Pin to event (optional QR)</label>
              <select value={registerEventId} onChange={(e) => setRegisterEventId(e.target.value)}>
                <option value="">Any open event (guest chooses)</option>
                {openEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}{ev.date ? ` (${ev.date})` : ""}</option>
                ))}
              </select>
            </div>
            {publicRegisterUrl ? (
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label>Shareable link</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" readOnly value={publicRegisterUrl} />
                    <button
                      type="button"
                      className="btn"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(publicRegisterUrl);
                          showNotif("Registration link copied");
                        } catch {
                          showNotif("Could not copy link", "error");
                        }
                      }}
                      style={{ background: theme.accent, color: "white", padding: "8px 12px", borderRadius: 10, fontSize: 12, whiteSpace: "nowrap" }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div style={{ padding: 8, background: "#fff", borderRadius: 10, border: `1px solid ${theme.border}` }}>
                  <QRCode value={publicRegisterUrl} size={112} />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: theme.textMuted }}>Enter your visitor-register Vercel URL above to generate a shareable link.</div>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ gridArea: "application", background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>Application</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
              Manage app updates and system information.
            </div>
            <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: theme.surface2, border: `1px solid ${theme.border}`, fontSize: 12 }}>
              <span style={{ color: theme.textMuted }}>Current Version: </span>
              <span style={{ fontWeight: 600, color: theme.text }}>{packageJson.version}</span>
              {updateAvailable && (
                <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 6, background: `${theme.accent}20`, border: `1px solid ${theme.accent}`, fontSize: 11 }}>
                  <span style={{ color: theme.accent, fontWeight: 600 }}>Update available: {updateInfo?.version || "latest"}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              className="btn"
              disabled={checkingUpdates || downloadingUpdate}
              onClick={checkForUpdates}
              style={{
                background: theme.accent,
                color: "white",
                padding: "9px 14px",
                borderRadius: 10,
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 7,
                opacity: checkingUpdates || downloadingUpdate ? 0.6 : 1,
              }}
            >
              {checkingUpdates ? (
                <>
                  <span style={{ width: 10, height: 10, borderRadius: 999, border: "2px solid rgba(255,255,255,.55)", borderTopColor: "white", display: "inline-block", animation: "spin 1s linear infinite" }} />
                  Checking…
                </>
              ) : (
                <>
                  <Icon name="refresh" size={16} /> Check for Updates
                </>
              )}
            </button>
            {updateAvailable && (
              <button
                className="btn"
                disabled={downloadingUpdate}
                onClick={downloadUpdate}
                style={{
                  background: "#10b981",
                  color: "white",
                  padding: "9px 14px",
                  borderRadius: 10,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  opacity: downloadingUpdate ? 0.6 : 1,
                }}
              >
                {downloadingUpdate ? (
                  <>
                    <span style={{ width: 10, height: 10, borderRadius: 999, border: "2px solid rgba(255,255,255,.55)", borderTopColor: "white", display: "inline-block", animation: "spin 1s linear infinite" }} />
                    Downloading…
                  </>
                ) : (
                  <>
                    <Icon name="download" size={16} /> Download Update
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: 18, paddingTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>System backup</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4, marginBottom: 12 }}>
            Download or restore members, events, attendance, visitors, profile, and saved settings. CSV backups are ZIP archives containing separate files.
          </div>
          <input ref={jsonBackupInputRef} type="file" accept=".json,application/json" onChange={(event) => importBackup(event, "json")} style={{ display: "none" }} />
          <input ref={csvBackupInputRef} type="file" accept=".zip,application/zip" onChange={(event) => importBackup(event, "csv")} style={{ display: "none" }} />
          <div className="backup-actions" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, maxWidth: 720 }}>
            <button type="button" className="btn" onClick={() => jsonBackupInputRef.current?.click?.()} disabled={!backupReady || creatingBackup || resettingData} style={{ background: `${theme.warning}18`, color: theme.warning, border: `1px solid ${theme.warning}50`, padding: "10px 12px", borderRadius: 8, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 46, width: "100%", textAlign: "center", lineHeight: 1.35, opacity: !backupReady || creatingBackup || resettingData ? 0.6 : 1 }}>
              <Icon name="upload" size={15} /> {creatingBackup ? "Processing…" : "Import JSON"}
            </button>
            <button type="button" className="btn" onClick={() => csvBackupInputRef.current?.click?.()} disabled={!backupReady || creatingBackup || resettingData} style={{ background: `${theme.warning}18`, color: theme.warning, border: `1px solid ${theme.warning}50`, padding: "10px 12px", borderRadius: 8, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 46, width: "100%", textAlign: "center", lineHeight: 1.35, opacity: !backupReady || creatingBackup || resettingData ? 0.6 : 1 }}>
              <Icon name="upload" size={15} /> {creatingBackup ? "Processing…" : "Import CSV"}
            </button>
            <button type="button" className="btn" onClick={downloadJsonBackup} disabled={!backupReady || creatingBackup || resettingData} style={{ background: theme.accent, color: "white", padding: "10px 12px", borderRadius: 8, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 46, width: "100%", textAlign: "center", lineHeight: 1.35, opacity: !backupReady || creatingBackup || resettingData ? 0.6 : 1 }}>
              <Icon name="download" size={15} /> Download JSON backup
            </button>
            <button type="button" className="btn" onClick={downloadCsvBackup} disabled={!backupReady || creatingBackup || resettingData} style={{ background: theme.surface2, color: theme.text, border: `1px solid ${theme.border}`, padding: "10px 12px", borderRadius: 8, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 46, width: "100%", textAlign: "center", lineHeight: 1.35, opacity: !backupReady || creatingBackup || resettingData ? 0.6 : 1 }}>
              <Icon name="download" size={15} /> Download CSV backup (.zip)
            </button>
          </div>
          {!backupReady && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>Waiting for data to finish loading…</div>}
          <div style={{ borderTop: `1px solid ${theme.border}`, marginTop: 16, paddingTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Reset my account data</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4, marginBottom: 10 }}>
              Choose whether to keep member records. Both options clear events, attendance, visitors, saved settings, and your audit history. Your profile and sign-in account are kept.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => resetOwnData(false)} disabled={!backupReady || creatingBackup || resettingData} style={{ background: `${theme.warning}18`, color: theme.warning, border: `1px solid ${theme.warning}55`, padding: "10px 14px", borderRadius: 8, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42, opacity: !backupReady || creatingBackup || resettingData ? 0.6 : 1 }}>
                <Icon name="refresh" size={15} /> {resettingData ? "Resetting…" : "Reset data (keep members)"}
              </button>
              <button type="button" className="btn" onClick={() => resetOwnData(true)} disabled={!backupReady || creatingBackup || resettingData} style={{ background: `${theme.danger}18`, color: theme.danger, border: `1px solid ${theme.danger}55`, padding: "10px 14px", borderRadius: 8, fontSize: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 42, opacity: !backupReady || creatingBackup || resettingData ? 0.6 : 1 }}>
                <Icon name="trash" size={15} /> {resettingData ? "Resetting…" : "Reset all data (including members)"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

