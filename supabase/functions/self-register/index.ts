import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const rateByIp = new Map<string, number[]>();

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip")
    || "unknown";
}

function rateLimited(ip: string) {
  const now = Date.now();
  const recent = (rateByIp.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    rateByIp.set(ip, recent);
    return true;
  }
  recent.push(now);
  rateByIp.set(ip, recent);
  return false;
}

function nextPrefixedId(ids: string[], prefix: string) {
  const nums = ids
    .map((id) => parseInt(String(id || "").replace(/^[A-Za-z]+/, ""), 10))
    .filter(Number.isFinite);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}${String(next).padStart(3, "0")}`;
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) throw new Error("Supabase is not configured on the server");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function ownerId() {
  const id = Deno.env.get("CHURCH_OWNER_ID") || "";
  if (!id) throw new Error("CHURCH_OWNER_ID is not set");
  return id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") || "";
    let payload: Record<string, unknown> = {};
    if (req.method === "POST") {
      payload = await req.json().catch(() => ({}));
      action = String(payload.action || action || "submit");
    } else if (req.method === "GET") {
      action = action || "events";
    } else {
      return json(405, { error: "Method not allowed" });
    }

    const supabase = adminClient();
    const churchOwnerId = ownerId();

    if (action === "events") {
      const { data, error } = await supabase
        .from("events")
        .select("id,name,date,time,status")
        .eq("owner_id", churchOwnerId)
        .in("status", ["Active", "Upcoming"])
        .order("date", { ascending: true });
      if (error) throw error;
      return json(200, { events: data || [] });
    }

    if (action === "search") {
      const q = String(payload.q ?? url.searchParams.get("q") ?? "").trim();
      if (q.length < 3) return json(200, { members: [] });
      const { data, error } = await supabase
        .from("members")
        .select("id,name")
        .eq("owner_id", churchOwnerId)
        .eq("archived", false)
        .ilike("name", `%${q.replace(/[%_,]/g, "")}%`)
        .limit(8);
      if (error) throw error;
      return json(200, { members: data || [] });
    }

    if (action === "submit") {
      if (String(payload.website || payload.company || "").trim()) {
        return json(200, { ok: true, ignored: true });
      }
      if (rateLimited(clientIp(req))) {
        return json(429, { error: "Too many registrations from this device. Please try again later." });
      }

      const name = String(payload.name || "").trim();
      const contact = String(payload.contact || "").trim().slice(0, 40);
      const eventId = String(payload.eventId || "").trim();
      const invitedBy = String(payload.invitedBy || "").trim();
      const notes = String(payload.notes || "").trim().slice(0, 500);
      if (!name) return json(400, { error: "Full name is required." });
      if (!eventId) return json(400, { error: "Please select an event." });

      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("id,name,date,status")
        .eq("owner_id", churchOwnerId)
        .eq("id", eventId)
        .maybeSingle();
      if (eventError) throw eventError;
      if (!event || !["Active", "Upcoming"].includes(String(event.status || ""))) {
        return json(400, { error: "That event is not open for self-registration." });
      }

      let invitedById = "";
      if (invitedBy) {
        const { data: inviter } = await supabase
          .from("members")
          .select("id")
          .eq("owner_id", churchOwnerId)
          .eq("id", invitedBy)
          .eq("archived", false)
          .maybeSingle();
        invitedById = inviter?.id || "";
      }

      const { data: visitors, error: visitorsError } = await supabase
        .from("visitors")
        .select("id,name,contact")
        .eq("owner_id", churchOwnerId);
      if (visitorsError) throw visitorsError;

      const nameKey = name.toLowerCase();
      const existing = (visitors || []).find((v) => {
        if (String(v.name || "").trim().toLowerCase() !== nameKey) return false;
        const vContact = String(v.contact || "").trim();
        if (contact && vContact) return vContact === contact;
        return !contact && !vContact;
      });

      let visitorId = existing?.id || "";
      if (!visitorId) {
        for (let attempt = 0; attempt < 5; attempt++) {
          visitorId = nextPrefixedId((visitors || []).map((v) => v.id), "V");
          const { error: insertError } = await supabase.from("visitors").insert({
            owner_id: churchOwnerId,
            id: visitorId,
            name,
            contact: contact || null,
            event_id: eventId,
            date: event.date || new Date().toISOString().slice(0, 10),
            invited_by: invitedById || null,
            notes: notes || null,
            converted_to_member: false,
          });
          if (!insertError) break;
          if (insertError.code === "23505") {
            visitors?.push({ id: visitorId, name, contact });
            visitorId = "";
            continue;
          }
          throw insertError;
        }
        if (!visitorId) throw new Error("Could not assign a visitor ID. Please try again.");
      }

      const { data: existingAtt } = await supabase
        .from("attendance")
        .select("id")
        .eq("owner_id", churchOwnerId)
        .eq("event_id", eventId)
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (existingAtt) {
        return json(200, {
          ok: true,
          duplicate: true,
          visitorId,
          eventName: event.name,
          message: `You're already checked in for ${event.name}.`,
        });
      }

      const { data: attendanceRows, error: attListError } = await supabase
        .from("attendance")
        .select("id")
        .eq("owner_id", churchOwnerId);
      if (attListError) throw attListError;

      let attendanceId = "";
      for (let attempt = 0; attempt < 5; attempt++) {
        attendanceId = nextPrefixedId((attendanceRows || []).map((r) => r.id), "A");
        const { error: insertAtt } = await supabase.from("attendance").insert({
          owner_id: churchOwnerId,
          id: attendanceId,
          member_id: null,
          visitor_id: visitorId,
          event_id: eventId,
          timestamp: new Date().toISOString(),
          member_name: name,
        });
        if (!insertAtt) break;
        if (insertAtt.code === "23505") {
          attendanceRows?.push({ id: attendanceId });
          attendanceId = "";
          continue;
        }
        throw insertAtt;
      }

      return json(200, {
        ok: true,
        visitorId,
        eventName: event.name,
        message: `You're checked in for ${event.name}.`,
      });
    }

    return json(400, { error: "Unknown action" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return json(500, { error: message });
  }
});
