import { useState } from "react";
import { Icon } from "./Icon.jsx";
import { EVENT_TEMPLATES } from "../constants.js";
import { canManageChurchData } from "../roles.js";
import { recordAuditLog } from "../auditLogs.js";


// ─── EVENTS VIEW ──────────────────────────────────────────────────────────────
function EventsView({ events, setEvents, attendance, setAttendance, members, theme, showNotif, currentUser }) {
  const [showModal, setShowModal] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: "", type: "Weekly Service", time: "" });
  const [templates, setTemplates] = useState(EVENT_TEMPLATES);
  const [form, setForm] = useState({ name: "", type: "Weekly Service", date: "", time: "", status: "Upcoming" });
  const [editEvent, setEditEvent] = useState(null); // null | event row
  const [searchQuery, setSearchQuery] = useState("");
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedEventForAttendance, setSelectedEventForAttendance] = useState(null);
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);

  const applyTemplate = t => { setForm(f => ({ ...f, name: t.name, type: t.type, time: t.time })); setShowTemplates(false); setShowModal(true); };

  const openEditTemplate = (t, idx) => {
    setEditingTemplate(idx);
    setTemplateForm({ name: t.name, type: t.type, time: t.time });
    setShowEditTemplate(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name || !templateForm.type || !templateForm.time) {
      showNotif("Please fill all fields", "error");
      return;
    }
    const updated = [...templates];
    updated[editingTemplate] = templateForm;
    setTemplates(updated);
    showNotif("Template updated");
    setShowEditTemplate(false);
    setEditingTemplate(null);
  };

  const deleteTemplate = (idx) => {
    setTemplateToDelete(idx);
    setShowConfirmDelete(true);
  };

  const confirmDeleteTemplate = () => {
    if (templateToDelete !== null) {
      setTemplates(prev => prev.filter((_, i) => i !== templateToDelete));
      showNotif("Template deleted");
      setShowConfirmDelete(false);
      setTemplateToDelete(null);
    }
  };

  const handleAdd = async () => {
    if (!form.name || !form.date) return;
    const ids = events.map(e => parseInt(e.id.slice(1))).filter(n => !isNaN(n));
    const newId = `E${String(ids.length > 0 ? Math.max(...ids) + 1 : 1).padStart(3, "0")}`;
    const created = { id: newId, ...form };
    setEvents(prev => [created, ...prev]);
    showNotif("Event created"); setShowModal(false);
    setForm({ name: "", type: "Weekly Service", date: "", time: "", status: "Upcoming" });
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "event_created",
        target: newId,
        source: "events",
        metadata: created,
      });
    } catch {}
  };

  const openCreate = () => {
    setEditEvent(null);
    setForm({ name: "", type: "Weekly Service", date: "", time: "", status: "Upcoming" });
    setShowModal(true);
  };

  const openEdit = (ev) => {
    setEditEvent(ev);
    setForm({
      name: ev.name || "",
      type: ev.type || "Weekly Service",
      date: ev.date || "",
      time: ev.time || "",
      status: ev.status || "Upcoming",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.date) return;
    if (!editEvent) {
      await handleAdd();
      return;
    }

    const before = editEvent;
    const after = { ...before, ...form };
    setEvents((prev) => prev.map((e) => (e.id === before.id ? after : e)));
    showNotif("Event updated");
    setShowModal(false);

    try {
      const fieldsToTrack = ["name", "type", "date", "time", "status"];
      const changedFields = fieldsToTrack
        .map((field) => {
          const beforeVal = before[field] ?? "";
          const afterVal = after[field] ?? "";
          if (String(beforeVal) === String(afterVal)) return null;
          return { field, before: beforeVal || null, after: afterVal || null };
        })
        .filter(Boolean);

      await recordAuditLog({
        actor: currentUser,
        action: "event_updated",
        target: before.id,
        source: "events",
        metadata: { eventId: before.id, changedFields },
      });
    } catch {}
  };

  const handleDelete = async id => {
    setEvents(prev => prev.filter(e => e.id !== id));
    showNotif("Event deleted", "warning");
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "event_deleted",
        target: id,
        source: "events",
        metadata: { eventId: id },
      });
    } catch {}
  };

  const handleActivate = async id => {
    setEvents(prev => prev.map(e => ({ ...e, status: e.id === id ? "Active" : e.status === "Active" ? "Completed" : e.status })));
    showNotif("Event activated");
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "event_activated",
        target: id,
        source: "events",
        metadata: { eventId: id },
      });
    } catch {}
  };

  const handleComplete = async id => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, status: "Completed" } : e));
    showNotif("Event marked complete");
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "event_completed",
        target: id,
        source: "events",
        metadata: { eventId: id },
      });
    } catch {}
  };

  const filteredEvents = events.filter(ev =>
    ev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ev.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ev.date.includes(searchQuery) ||
    ev.status.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getAttendanceCount = (eventId) => {
    // Validation filter: ensure events exist before counting
    const validEventIds = new Set(events.map(e => e.id));
    return attendance.filter(a => a.eventId === eventId && validEventIds.has(a.eventId)).length;
  };

  const getAttendanceRecords = (eventId) => {
    // Validation filter: only include records with valid eventId and memberId
    const validMemberIds = new Set(members.map(m => m.id));
    const eventAttendance = attendance.filter(a => 
      a.eventId === eventId && validMemberIds.has(a.memberId)
    );
    return eventAttendance.map(record => {
      const member = members.find(m => m.id === record.memberId);
      return {
        ...record,
        memberName: member?.name || "Unknown",
        memberMinistriy: member?.ministry || "—",
        memberAgeGroup: member?.ageGroup || "—",
      };
    });
  };

  const openAttendanceModal = (event) => {
    setSelectedEventForAttendance(event);
    setAttendanceSearchQuery("");
    setShowAttendanceModal(true);
  };

  const deleteAttendanceRecord = async (recordId) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this attendance record? This cannot be undone."
    );
    if (!confirmed) return;

    setAttendance(prev => prev.filter(a => a.id !== recordId));
    showNotif("Attendance record deleted", "warning");
    try {
      await recordAuditLog({
        actor: currentUser,
        action: "attendance_deleted",
        target: recordId,
        source: "events",
        metadata: { eventId: selectedEventForAttendance?.id, recordId },
      });
    } catch {}
  };

  const getFilteredAttendanceRecords = (eventId, searchTerm) => {
    const records = getAttendanceRecords(eventId);
    if (!searchTerm.trim()) return records;
    return records.filter(record =>
      record.memberName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const getAttendanceStatsByAgeGroup = (eventId) => {
    const records = getAttendanceRecords(eventId);
    const stats = {};
    records.forEach(record => {
      const ageGroup = record.memberAgeGroup || "—";
      stats[ageGroup] = (stats[ageGroup] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => {
      if (a[0] === "—") return 1;
      if (b[0] === "—") return -1;
      return a[0].localeCompare(b[0]);
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}><Icon name="search" size={15} /></div>
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 34 }}
          />
        </div>
        {canManageChurchData(currentUser.role) && (
          <>
            <button className="btn" onClick={() => setShowTemplates(true)} style={{ background: `${theme.accent2}18`, color: theme.accent2, padding: "8px 16px", borderRadius: 8, fontSize: 13, border: `1px solid ${theme.accent2}30`, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="template" size={15} /> Use Template
            </button>
            <button className="btn" onClick={openCreate} style={{ background: theme.accent, color: "white", padding: "8px 16px", borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
              <Icon name="add" size={15} /> Create Event
            </button>
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(270px,1fr))", gap: 14 }}>
        {filteredEvents.map((ev, i) => (
          <div key={ev.id} className="card" style={{ background: theme.surface, border: `1px solid ${ev.status === "Active" ? theme.success + "50" : theme.border}`, borderRadius: 13, padding: 18, animationDelay: `${i * .07}s` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 9, background: `${theme.accent}18`, display: "flex", alignItems: "center", justifyContent: "center", color: theme.accent }}>
                <Icon name="events" size={20} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className={`badge tag-${ev.status.toLowerCase()}`}>{ev.status}</span>
                {canManageChurchData(currentUser.role) && (
                  <button
                    className="btn"
                    type="button"
                    onClick={() => openEdit(ev)}
                    title="Edit event"
                    style={{
                      background: theme.surface2,
                      color: theme.textMuted,
                      padding: "6px 8px",
                      borderRadius: 8,
                      border: `1px solid ${theme.border}`,
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Icon name="edit" size={14} />
                  </button>
                )}
              </div>
            </div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{ev.name}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>{ev.type}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 5 }}>{ev.date} • {ev.time}</div>
            {ev.status === "Completed" && (
              <div style={{ fontSize: 12, color: theme.success, marginTop: 6, fontWeight: 500, display: "flex", alignItems: "center", gap: 5 }}>
                <Icon name="check" size={14} /> {getAttendanceCount(ev.id)} attendance
              </div>
            )}
            {canManageChurchData(currentUser.role) && (
              <div style={{ display: "flex", gap: 7, marginTop: 14 }}>
                {ev.status === "Upcoming" && <button className="btn" onClick={() => handleActivate(ev.id)} style={{ flex: 1, background: `${theme.success}15`, color: theme.success, padding: "6px", borderRadius: 7, fontSize: 12, fontWeight: 500 }}>Activate</button>}
                {ev.status === "Active" && <button className="btn" onClick={() => handleComplete(ev.id)} style={{ flex: 1, background: `${theme.accent2}15`, color: theme.accent2, padding: "6px", borderRadius: 7, fontSize: 12, fontWeight: 500 }}>Complete</button>}
                {ev.status === "Completed" && <button className="btn" onClick={() => openAttendanceModal(ev)} style={{ flex: 1, background: `${theme.accent}15`, color: theme.accent, padding: "6px", borderRadius: 7, fontSize: 12, fontWeight: 500 }}>View Attendance</button>}
                {ev.status !== "Active" && <button className="btn" onClick={() => handleDelete(ev.id)} style={{ background: `${theme.danger}15`, color: theme.danger, padding: "6px 10px", borderRadius: 7 }}><Icon name="trash" size={14} /></button>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <div className="modal-overlay" onClick={() => setShowTemplates(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Event Templates</h2>
              <button className="btn" onClick={() => setShowTemplates(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {templates.map((t, i) => (
                <div key={i} style={{ background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <button onClick={() => applyTemplate(t)} style={{ background: "transparent", border: "none", color: theme.text, textAlign: "left", flex: 1, cursor: "pointer", padding: 0 }}>
                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{t.type} • {t.time}</div>
                  </button>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn" onClick={() => openEditTemplate(t, i)} title="Edit" style={{ background: "transparent", color: theme.accent, padding: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="edit" size={14} />
                    </button>
                    <button className="btn" onClick={() => deleteTemplate(i)} title="Delete" style={{ background: "transparent", color: theme.danger, padding: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {showEditTemplate && (
        <div className="modal-overlay" onClick={() => setShowEditTemplate(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>Edit Template</h2>
              <button className="btn" onClick={() => setShowEditTemplate(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div><label>Template Name *</label><input type="text" value={templateForm.name} onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sunday Worship Service" /></div>
              <div>
                <label>Event Type</label>
                <select value={templateForm.type} onChange={e => setTemplateForm(f => ({ ...f, type: e.target.value }))}>
                  {["Weekly Service", "Prayer Meeting", "Youth Ministry", "Children's Church", "Special Event"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label>Default Time</label><input type="time" value={templateForm.time} onChange={e => setTemplateForm(f => ({ ...f, time: e.target.value }))} /></div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowEditTemplate(false)} style={{ background: theme.surface2, color: theme.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Cancel</button>
              <button className="btn" onClick={handleSaveTemplate} style={{ background: theme.accent, color: "white", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Template Confirmation Modal */}
      {showConfirmDelete && (
        <div className="modal-overlay" onClick={() => setShowConfirmDelete(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 360 }}>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Delete Template?</h2>
              <p style={{ fontSize: 13, color: theme.textMuted, margin: "8px 0 0 0" }}>This action cannot be undone.</p>
            </div>
            <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowConfirmDelete(false)} style={{ background: theme.surface2, color: theme.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Cancel</button>
              <button className="btn" onClick={confirmDeleteTemplate} style={{ background: theme.danger, color: "white", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 440 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>{editEvent ? "Edit Event" : "Create Event"}</h2>
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div><label>Event Name *</label><input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sunday Worship Service" /></div>
              <div>
                <label>Event Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {["Weekly Service", "Prayer Meeting", "Youth Ministry", "Children's Church", "Special Event"].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label>Date *</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><label>Time</label><input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
              </div>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {["Upcoming", "Active", "Completed"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 22, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShowModal(false)} style={{ background: theme.surface2, color: theme.text, padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>Cancel</button>
              <button className="btn" onClick={handleSave} style={{ background: theme.accent, color: "white", padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500 }}>{editEvent ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendanceModal && selectedEventForAttendance && (
        <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 26, width: "100%", maxWidth: 900 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{selectedEventForAttendance.name}</h2>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{selectedEventForAttendance.date} • {selectedEventForAttendance.time}</div>
              </div>
              <button className="btn" onClick={() => setShowAttendanceModal(false)} style={{ background: "transparent", color: theme.textMuted, padding: 4 }}><Icon name="close" size={18} /></button>
            </div>

            {/* Data Integrity Warning & Debug Info */}
            {getAttendanceRecords(selectedEventForAttendance.id).length > 0 && selectedEventForAttendance.status === "Active" && (
              <div style={{ background: `${theme.warning}18`, border: `1px solid ${theme.warning}40`, borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12, color: theme.warning, display: "flex", gap: 10, alignItems: "flex-start" }}>
                <Icon name="alert" size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>⚠️ Active Event Has Records:</strong> This event is still active but already has {getAttendanceRecords(selectedEventForAttendance.id).length} attendance record(s). Ensure these were legitimately scanned in Kiosk Mode.
                  <div style={{ fontSize: 10, opacity: 0.8, marginTop: 6, fontFamily: "monospace", background: "rgba(0,0,0,0.2)", padding: 6, borderRadius: 4 }}>
                    Event ID: {selectedEventForAttendance.id} | Valid Records: {getAttendanceRecords(selectedEventForAttendance.id).length}
                  </div>
                </div>
              </div>
            )}

            {/* Stats Section */}
            <div style={{ background: theme.surface2, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 22, display: "flex", gap: 0, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 100, padding: "0 10px", borderRight: `1px solid ${theme.border}` }}>
                <div style={{ fontSize: 14, color: theme.textMuted, textTransform: "uppercase", fontWeight: 1000, letterSpacing: "0.5px" }}>Total</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: theme.accent, marginTop: 3 }}>{getAttendanceRecords(selectedEventForAttendance.id).length}</div>
              </div>
              {getAttendanceStatsByAgeGroup(selectedEventForAttendance.id).map(([ageGroup, count], idx, arr) => (
                <div key={ageGroup} style={{ flex: 1, minWidth: 100, padding: "0 10px", borderRight: idx === arr.length - 1 ? "none" : `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.5px" }}>{ageGroup}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: theme.accent2, marginTop: 3 }}>{count}</div>
                </div>
              ))}
            </div>

            {/* Search Bar */}
            <div style={{ position: "relative", marginBottom: 16 }}>
              <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: theme.textMuted, pointerEvents: "none" }}><Icon name="search" size={15} /></div>
              <input
                type="text"
                placeholder="Search attendee..."
                value={attendanceSearchQuery}
                onChange={e => setAttendanceSearchQuery(e.target.value)}
                style={{ width: "100%", paddingLeft: 38 }}
              />
            </div>

            {/* Attendance Table */}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <th style={{ padding: "12px 0", textAlign: "left", color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>#</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Member</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Ministry</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Check-in</th>
                    <th style={{ padding: "12px 8px", textAlign: "left", color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Status</th>
                    {canManageChurchData(currentUser.role) && <th style={{ padding: "12px 8px", textAlign: "center", color: theme.textMuted, fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {getFilteredAttendanceRecords(selectedEventForAttendance.id, attendanceSearchQuery).map((record, idx) => (
                    <tr key={record.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: "12px 0", color: theme.textMuted }}>{idx + 1}</td>
                      <td style={{ padding: "12px 8px", fontWeight: 500, color: theme.text }}>{record.memberName}</td>
                      <td style={{ padding: "12px 8px", color: theme.textMuted, fontSize: 12 }}>{record.memberMinistriy}</td>
                      <td style={{ padding: "12px 8px", color: theme.success, fontWeight: 500 }}>{record.timestamp ? new Date(record.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td style={{ padding: "12px 8px" }}><span style={{ background: `${theme.success}18`, color: theme.success, padding: "4px 8px", borderRadius: 6, fontSize: 11, fontWeight: 500 }}>Present</span></td>
                      {canManageChurchData(currentUser.role) && (
                        <td style={{ padding: "12px 8px", textAlign: "center" }}>
                          <button
                            className="btn"
                            onClick={() => deleteAttendanceRecord(record.id)}
                            title="Delete record"
                            style={{
                              background: "transparent",
                              color: theme.danger,
                              padding: "4px 6px",
                              borderRadius: 4,
                              border: "none",
                              cursor: "pointer",
                              fontSize: 12,
                            }}
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {getFilteredAttendanceRecords(selectedEventForAttendance.id, attendanceSearchQuery).length === 0 && (
                <div style={{ padding: 20, textAlign: "center", color: theme.textMuted }}>No attendance records found</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EventsView;
