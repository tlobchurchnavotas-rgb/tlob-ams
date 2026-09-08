import { useEffect, useMemo, useRef, useState } from "react";
import { toDataURL } from "qrcode";
import { fetchPublicEvents, searchPublicMembers, submitPublicVisitor } from "./api.js";
import { claimFromLocation } from "./claim.js";
import MemberIdCard from "./MemberIdCard.jsx";

function preparePhoto(file) {
  return new Promise((resolve, reject) => {
    if (!file) { resolve(""); return; }
    if (!file.type.startsWith("image/")) { reject(new Error("Please choose an image file.")); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const size = Math.min(image.naturalWidth, image.naturalHeight);
        const sx = (image.naturalWidth - size) / 2;
        const sy = (image.naturalHeight - size) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 160;
        canvas.getContext("2d").drawImage(image, sx, sy, size, size, 0, 0, 160, 160);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.onerror = () => reject(new Error("Could not read that image."));
      image.src = String(reader.result || "");
    };
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

const C = {
  bg: "#f0f4ff",
  card: "#ffffff",
  muted: "#5a6a8a",
  text: "#1a2340",
  border: "#dde3f0",
  surface2: "#f4f7ff",
  accent: "#6366f1",
  success: "#10b981",
  danger: "#ef4444",
};

function eventFromQuery() {
  try {
    return new URLSearchParams(window.location.search).get("event") || "";
  } catch {
    return "";
  }
}

function VisitorIdQr({ visitorId }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!visitorId) return undefined;
    let cancelled = false;
    toDataURL(visitorId, { width: 280, margin: 1, color: { dark: "#1a1a2e", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setSrc(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [visitorId]);
  if (!src) return null;
  return <img src={src} width={160} height={160} alt="Visitor QR" />;
}

export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    name: "",
    contact: "",
    eventId: eventFromQuery(),
    invitedBy: "",
    invitedByName: "",
    email: "",
    website: "",
    photo: "",
  });
  const [memberQuery, setMemberQuery] = useState("");
  const [memberHits, setMemberHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const searchTimer = useRef(null);
  const claim = useMemo(() => claimFromLocation(), []);

  useEffect(() => {
    document.title = claim ? "Virtual Member ID · TLOB" : "Visitor registration · TLOB";
  }, [claim]);

  useEffect(() => {
    if (claim) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError("");
      try {
        const data = await fetchPublicEvents();
        const list = data?.events || [];
        if (!cancelled) {
          setEvents(list);
          setForm((f) => {
            const pinned = eventFromQuery();
            const validPinned = list.some((e) => e.id === pinned);
            if (validPinned) return { ...f, eventId: pinned };
            if (f.eventId && list.some((e) => e.id === f.eventId)) return f;
            const firstActive = list.find((e) => e.status === "Active") || list[0];
            return { ...f, eventId: firstActive?.id || "" };
          });
        }
      } catch (e) {
        if (!cancelled) setLoadError(e?.message || "Could not load events.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [claim]);

  useEffect(() => {
    if (claim) return undefined;
    const q = memberQuery.trim();
    if (q.length < 3) {
      setMemberHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const data = await searchPublicMembers(q);
        setMemberHits(data?.members || []);
      } catch {
        setMemberHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [memberQuery, claim]);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === form.eventId) || null,
    [events, form.eventId],
  );
  const eventLocked = Boolean(eventFromQuery() && events.some((e) => e.id === eventFromQuery()));

  const onSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim()) {
      setFormError("Full name is required.");
      return;
    }
    if (!form.eventId) {
      setFormError("Please select an event.");
      return;
    }
    if (!consentChecked) {
      setFormError("Please confirm you agree to the data privacy notice.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await submitPublicVisitor({
        name: form.name.trim(),
        contact: form.contact.trim(),
        eventId: form.eventId,
        invitedBy: form.invitedBy,
        email: form.email.trim(),
        website: form.website,
        photo: form.photo,
      });
      setResult(data);
      window.setTimeout(() => {
        try { window.close(); } catch {}
      }, 1200);
    } catch (err) {
      setFormError(err?.message || "Could not complete registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    background: C.surface2,
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    color: C.text,
    fontSize: 16,
    outline: "none",
    fontFamily: "inherit",
  };

  return (
    <div style={{ minHeight: "100vh", background: claim ? "linear-gradient(180deg, #dbe7ff 0%, #f4f7ff 45%, #ffffff 100%)" : C.bg, color: C.text, fontFamily: "'DM Sans','Segoe UI',sans-serif", padding: "28px 16px 48px", colorScheme: "only light" }}>
      <style>{`
        :root, html, body { color-scheme: only light; background: ${claim ? "#dbe7ff" : C.bg}; }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=DM+Mono:wght@500&family=Inter:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        label{display:block;font-size:11px;font-weight:700;color:${C.muted};margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;}
      `}</style>
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <img src="/logo.png" alt="TLOB" style={{ width: 52, height: 52, borderRadius: "50%", objectFit: "cover", border: `3px solid ${C.border}` }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.2 }}>The Lord Our Banner</div>
            <div style={{ fontSize: 12, color: C.muted }}>{claim ? "Virtual Member Card" : "Visitor self-registration"}</div>
          </div>
        </div>

        {claim ? (
          <MemberIdCard claim={claim} />
        ) : result ? (
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, textAlign: "center", boxShadow: "0 10px 28px rgba(26,35,64,.08)" }}>
            <div style={{ width: 58, height: 58, borderRadius: "50%", margin: "0 auto 14px", background: `${C.success}18`, color: C.success, display: "grid", placeItems: "center", fontSize: 28, fontWeight: 800 }}>✓</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{result.duplicate ? "Already checked in" : "You're checked in"}</div>
            <div style={{ marginTop: 8, fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
              {result.message || `You're checked in for ${result.eventName || selectedEvent?.name || "today's event"}.`}
            </div>
            <div style={{ marginTop: 18, padding: "14px 12px", borderRadius: 12, background: C.surface2, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: ".08em" }}>YOUR VISITOR ID</div>
              <div style={{ marginTop: 4, fontFamily: "'DM Mono', monospace", fontSize: 28, fontWeight: 700, letterSpacing: ".08em" }}>{result.visitorId}</div>
              {result.visitorId && (
                <div style={{ display: "inline-block", marginTop: 12, padding: 8, background: "#fff", borderRadius: 12 }}>
                  <VisitorIdQr visitorId={result.visitorId} />
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>Save this QR and scan it at the kiosk next time you attend.</div>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setConsentChecked(false);
                setForm((f) => ({ ...f, name: "", contact: "", invitedBy: "", invitedByName: "", email: "", photo: "", website: "" }));
                setMemberQuery("");
              }}
              style={{ marginTop: 18, width: "100%", padding: "12px 16px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              Register another visitor
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, boxShadow: "0 10px 28px rgba(26,35,64,.08)", display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Welcome, guest</div>
              <div style={{ marginTop: 4, fontSize: 12, color: C.muted, lineHeight: 1.45 }}>
                Fill this in to log your visit and record attendance.
              </div>
            </div>

            {loading ? (
              <div style={{ fontSize: 13, color: C.muted }}>Loading events…</div>
            ) : loadError ? (
              <div style={{ fontSize: 13, color: C.danger }}>{loadError}</div>
            ) : events.length === 0 ? (
              <div style={{ fontSize: 13, color: C.muted }}>No open events right now. Please check in at the kiosk or with an usher.</div>
            ) : (
              <>
                <div>
                  <label htmlFor="reg-name">Full Name *</label>
                  <input id="reg-name" style={inputStyle} autoComplete="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Visitor name" />
                </div>
                <div>
                  <label htmlFor="reg-email">Email Address</label>
                  <input id="reg-email" type="email" style={inputStyle} autoComplete="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@example.com" />
                </div>
                <div>
                  <label htmlFor="reg-contact">Contact Number</label>
                  <input id="reg-contact" type="tel" style={inputStyle} autoComplete="tel" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="09XXXXXXXXX" />
                </div>
                <div>
                  <label htmlFor="reg-event">Event</label>
                  <select
                    id="reg-event"
                    style={inputStyle}
                    disabled={eventLocked}
                    value={form.eventId}
                    onChange={(e) => setForm((f) => ({ ...f, eventId: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>{ev.name}{ev.date ? ` (${ev.date})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div style={{ position: "relative" }}>
                  <label htmlFor="reg-invited">Invited By (Member)</label>
                  {form.invitedBy ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, ...inputStyle }}>{form.invitedByName || form.invitedBy}</div>
                      <button
                        type="button"
                        onClick={() => { setForm((f) => ({ ...f, invitedBy: "", invitedByName: "" })); setMemberQuery(""); }}
                        style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface2, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12 }}
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        id="reg-invited"
                        style={inputStyle}
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder="Type at least 3 letters"
                        autoComplete="off"
                      />
                      {(searching || memberHits.length > 0) && (
                        <div style={{ position: "absolute", left: 0, right: 0, top: "100%", zIndex: 5, background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, marginTop: 4, maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 20px rgba(0,0,0,.08)" }}>
                          {searching && <div style={{ padding: 10, fontSize: 12, color: C.muted }}>Searching…</div>}
                          {memberHits.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => {
                                setForm((f) => ({ ...f, invitedBy: m.id, invitedByName: m.name }));
                                setMemberQuery("");
                                setMemberHits([]);
                              }}
                              style={{ width: "100%", textAlign: "left", padding: "10px 12px", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}
                            >
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div>
                  <label htmlFor="reg-photo">Photo (optional, 1x1)</label>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {form.photo ? <img src={form.photo} alt="Photo preview" style={{ width: 58, height: 58, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.border}` }} /> : null}
                    <div style={{ flex: 1 }}>
                      <input
                        id="reg-photo"
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          try {
                            const photo = await preparePhoto(e.target.files?.[0]);
                            setForm((f) => ({ ...f, photo }));
                          } catch (error) {
                            setFormError(error?.message || "Could not process that image.");
                          } finally {
                            e.target.value = "";
                          }
                        }}
                        style={{ ...inputStyle, padding: "9px 10px", fontSize: 14 }}
                      />
                      <div style={{ marginTop: 4, fontSize: 11, color: C.muted }}>Optional photo used to identify you in attendance records, kiosk check-in attendance, and recent attendance lists. The image will be cropped to a square.</div>
                    </div>
                    {form.photo ? <button type="button" onClick={() => setForm((f) => ({ ...f, photo: "" }))} style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface2, color: C.text, fontWeight: 700, cursor: "pointer" }}>Remove</button> : null}
                  </div>
                </div>
                <div aria-hidden="true" style={{ position: "absolute", left: -9999, opacity: 0, height: 0, overflow: "hidden" }}>
                  <label htmlFor="reg-website">Website</label>
                  <input id="reg-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
                </div>
                <div style={{ padding: "12px 12px 10px", borderRadius: 10, background: C.surface2, border: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, margin: 0 }}>
                    By checking in, you allow The Lord Our Banner Christian Church to collect and use your name, contact details, and optional photo to identify you in attendance records, kiosk check-in, and recent attendance lists, in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).
                  </p>
                  <label htmlFor="reg-consent" style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 10, marginBottom: 0, textTransform: "none", letterSpacing: 0, fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer", lineHeight: 1.45 }}>
                    <input
                      id="reg-consent"
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, flexShrink: 0, accentColor: C.accent, cursor: "pointer" }}
                    />
                    <span>I agree that the church may collect and use my information for this visit.</span>
                  </label>
                </div>
                {formError && <div style={{ fontSize: 13, color: C.danger }}>{formError}</div>}
                <button
                  type="submit"
                  disabled={submitting || !form.name.trim() || !form.eventId || !consentChecked}
                  style={{
                    marginTop: 4,
                    width: "100%",
                    padding: "13px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: C.accent,
                    color: "white",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: submitting ? "wait" : "pointer",
                    fontFamily: "inherit",
                    opacity: form.name.trim() && form.eventId && consentChecked ? 1 : 0.5,
                  }}
                >
                  {submitting ? "Saving…" : "Save & Check In"}
                </button>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
