import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../supabaseClient.js";
import { Icon } from "./Icon.jsx";

function formatDateTime(value) {
  if (!value) return "Unknown";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString();
}

function normalizeRow(row) {
  return {
    id: row?.id || `${row?.created_at || "na"}-${row?.action || "na"}-${Math.random()}`,
    created_at: row?.created_at || null,
    actor_name: row?.actor_name || "System",
    actor_role: row?.actor_role || "",
    action: row?.action || "unknown",
    target: row?.target || "",
    source: row?.source || "app",
    metadata: row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
  };
}

function getActionSummary(row) {
  const md = row.metadata || {};
  const a = row.action || "";

  if (a === "member_updated") {
    const bits = [];
    if (Array.isArray(md.changedFields) && md.changedFields.length) {
      md.changedFields.forEach((c) => {
        if (!c || !c.field) return;
        const label = ({
          name: "Name",
          contact: "Contact",
          ministry: "Ministry",
          ageGroup: "Age group",
          status: "Status",
          joined: "Joined",
          birthday: "Birthday",
          anniversary: "Anniversary",
        }[c.field] || c.field);
        bits.push(`${label}: ${c.before || "—"} -> ${c.after || "—"}`);
      });
    } else {
      if (md.beforeJoined !== undefined || md.afterJoined !== undefined) bits.push(`Joined: ${md.beforeJoined || "—"} -> ${md.afterJoined || "—"}`);
      if (md.beforeStatus !== undefined || md.afterStatus !== undefined) bits.push(`Status: ${md.beforeStatus || "—"} -> ${md.afterStatus || "—"}`);
    }
    if (bits.length) return bits.join(", ");
  }

  if (a === "member_created") {
    if (md.name && md.joined) return `${md.name} (Joined: ${md.joined})`;
    if (md.name) return md.name;
    if (md.joined) return `Joined: ${md.joined}`;
  }

  if (a === "member_archived") return `Member archived`;
  if (a === "member_restored") return `Member restored`;

  if (a.startsWith("event_")) {
    if (md.eventId) return `Event: ${md.eventId}`;
    if (md.eventId) return `Event: ${md.eventId}`;
    return a.replace(/^event_/, "Event ");
  }

  if (a === "attendance_checked_in") {
    const memberId = md.memberId ? String(md.memberId) : row.target || "—";
    const eventId = md.eventId ? String(md.eventId) : "—";
    return `Check-in: ${memberId} @ ${eventId}`;
  }

  if (a === "visitor_logged") {
    if (md.name && md.date && md.eventId) return `${md.name} (${md.date}) · ${md.eventId}`;
    if (md.name && md.eventId) return `${md.name} · ${md.eventId}`;
    if (md.name) return md.name;
  }

  if (a === "visitor_converted_to_member") {
    if (md.name && md.memberId) return `${md.name} -> ${md.memberId}`;
    if (md.memberId) return `Converted -> ${md.memberId}`;
  }

  if (a.startsWith("auth_")) {
    if (md?.email) return md.email;
    return a;
  }

  if (a === "account_updated") {
    const bits = [];
    if (md.previousRole && md.newRole) bits.push(`Role: ${md.previousRole} -> ${md.newRole}`);
    if (md.previousName && md.newName) bits.push(`Name: ${md.previousName} -> ${md.newName}`);
    return bits.length ? bits.join(", ") : "Account updated";
  }

  if (a === "profile_updated") {
    if (md.name) return `Profile: ${md.name}`;
    return "Profile updated";
  }

  return a;
}

export default function AuditLogsView({ theme, showNotif }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("all");
  const [query, setQuery] = useState("");
  const [errorState, setErrorState] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorState("");
      try {
        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase
            .from("audit_logs")
            .select("id,created_at,actor_name,actor_role,action,target,metadata,source")
            .order("created_at", { ascending: false })
            .limit(300);

          if (error) throw error;
          if (!cancelled) setRows((data || []).map(normalizeRow));
          return;
        }

        const raw = localStorage.getItem("tlob_audit_logs");
        const parsed = raw ? JSON.parse(raw) : [];
        if (!cancelled) setRows(Array.isArray(parsed) ? parsed.map(normalizeRow) : []);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setErrorState("Could not load audit logs.");
        }
        showNotif(e?.message || "Could not load audit logs.", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [showNotif]);

  const actionOptions = useMemo(() => {
    const unique = Array.from(new Set(rows.map((r) => r.action).filter(Boolean)));
    return unique.sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filterAction !== "all" && row.action !== filterAction) return false;
      if (!q) return true;
      const details = JSON.stringify(row.metadata || {}).toLowerCase();
      return (
        row.actor_name.toLowerCase().includes(q) ||
        row.actor_role.toLowerCase().includes(q) ||
        row.action.toLowerCase().includes(q) ||
        row.target.toLowerCase().includes(q) ||
        row.source.toLowerCase().includes(q) ||
        details.includes(q)
      );
    });
  }, [rows, filterAction, query]);

  const exportCsv = () => {
    const header = ["Timestamp", "Actor", "Role", "Action", "What was performed", "Target", "Source", "Details"];
    const lines = filteredRows.map((row) => [
      formatDateTime(row.created_at),
      row.actor_name,
      row.actor_role || "",
      row.action,
      getActionSummary(row),
      row.target || "",
      row.source || "",
      JSON.stringify(row.metadata || {}),
    ]);
    const csv = [header, ...lines]
      .map((cols) => cols.map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showNotif("Audit logs exported.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: "100%" }}>
      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-.01em" }}>Audit Logs</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
              Review key system actions and account activity.
            </div>
          </div>
          <button
            className="btn"
            type="button"
            onClick={exportCsv}
            disabled={loading || filteredRows.length === 0}
            style={{
              background: theme.surface2,
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              opacity: loading || filteredRows.length === 0 ? 0.6 : 1,
            }}
          >
            <Icon name="download" size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 240px) 1fr", gap: 10 }}>
          <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
            <option value="all">All actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actor, action, target, source, details…"
          />
        </div>
      </div>

      <div className="card" style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: "hidden", width: "100%" }}>
        {loading ? (
          <div style={{ padding: 26, textAlign: "center", color: theme.textMuted, fontSize: 13 }}>Loading audit logs…</div>
        ) : filteredRows.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Action</th>
                <th>What was performed</th>
                <th>Target</th>
                <th>Source</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(row.created_at)}</td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>{row.actor_name}</div>
                    {row.actor_role && <div style={{ fontSize: 11, color: theme.textMuted }}>{row.actor_role}</div>}
                  </td>
                  <td><span className="badge" style={{ background: `${theme.accent}14`, color: theme.accent }}>{row.action}</span></td>
                  <td style={{ fontSize: 12, minWidth: 260 }}>{getActionSummary(row)}</td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{row.target || "—"}</td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>{row.source || "—"}</td>
                  <td style={{ maxWidth: 520 }}>
                    <code style={{ fontSize: 11, color: theme.textMuted, fontFamily: "DM Mono,monospace" }}>
                      {JSON.stringify(row.metadata || {})}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 13, color: theme.text, fontWeight: 700 }}>No audit logs found.</div>
            <div style={{ marginTop: 7, fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
              {errorState
                ? "There was a loading issue. Check table permissions and schema."
                : "If you use Supabase, create the `audit_logs` table and related RLS policy to populate this view."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
