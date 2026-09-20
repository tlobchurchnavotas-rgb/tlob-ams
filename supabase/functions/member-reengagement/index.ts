import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const cronSecret = Deno.env.get("CRON_SECRET");
const fromEmail = Deno.env.get("REENGAGEMENT_FROM_EMAIL") || "TLOB Church <noreply@example.com>";
const appUrl = Deno.env.get("APP_URL") || "";
const logoUrl = Deno.env.get("LOGO_URL") || `${appUrl.replace(/\/$/, "")}/logo_embedded.png`;
const supabase = createClient(supabaseUrl, serviceRoleKey);

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[character] || character));
}

function buildEmailContent(name: string, churchLogoUrl: string) {
  const safeName = escapeHtml(name);
  const safeLogoUrl = escapeHtml(churchLogoUrl);
  const html = `
    <div style="margin:0;background:#f4f7fb;color:#17233d;font-family:Arial,Helvetica,sans-serif;line-height:1.6">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0">We would love to welcome you back at TLOB Church.</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr><td style="padding:32px 16px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #dce4f0;border-radius:16px;overflow:hidden">
            <tr><td style="padding:24px 32px;background:#173b75;color:#ffffff">
              <img src="${safeLogoUrl}" width="72" height="72" alt="The Lord Our Banner Christian Church logo" style="display:block;width:72px;height:72px;object-fit:contain;margin:0 0 16px;border:0">
              <div style="font-size:12px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#b9d8ff">The Lord Our Banner</div>
              <div style="margin-top:6px;font-size:24px;font-weight:bold;line-height:1.25">We miss you at TLOB Church</div>
            </td></tr>
            <tr><td style="padding:32px">
              <p style="margin:0 0 18px;font-size:17px">Hi ${safeName},</p>
              <p style="margin:0 0 16px;color:#4b5b75">It has been a while since we last saw you, and we wanted you to know that you are remembered and valued by our church family.</p>
              <p style="margin:0 0 24px;color:#4b5b75">We would be happy to welcome you back at an upcoming service or event. We hope to see you again soon.</p>
              <p style="margin:0;color:#4b5b75">With care,<br><strong style="color:#17233d">TLOB Church</strong></p>
            </td></tr>
            <tr><td style="padding:18px 32px;background:#f7f9fc;border-top:1px solid #e7edf5;color:#71809a;font-size:11px">The Lord Our Banner Christian Church<br>This is a friendly invitation from your church family.</td></tr>
          </table>
        </td></tr>
      </table>
    </div>`;
  const text = `Hi ${name},\n\nIt has been a while since we last saw you, and we wanted you to know that you are remembered and valued by our church family.\n\nWe would be happy to welcome you back at an upcoming service or event. We hope to see you again soon.\n\nWith care,\nTLOB Church`;
  return { html, text };
}

Deno.serve(async (request) => {
  if (cronSecret && request.headers.get("x-cron-secret") !== cronSecret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!resendApiKey) return Response.json({ error: "RESEND_API_KEY is not configured" }, { status: 500 });

  await supabase.rpc("mark_members_inactive");
  const { data: queue, error } = await supabase
    .from("member_reengagement_queue")
    .select("id,owner_id,email,member_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0;
  for (const item of queue || []) {
    const { data: member } = await supabase
      .from("members")
      .select("name")
      .eq("owner_id", item.owner_id)
      .eq("id", item.member_id)
      .maybeSingle();
    const rawName = member?.name || "there";
    const emailContent = buildEmailContent(rawName, logoUrl);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [item.email],
        subject: "We would love to welcome you back to TLOB Church",
        html: emailContent.html,
        text: emailContent.text,
      }),
    });
    if (response.ok) {
      await supabase.from("member_reengagement_queue").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", item.id);
      sent += 1;
    } else {
      await supabase.from("member_reengagement_queue").update({ status: "failed", error: await response.text() }).eq("id", item.id);
    }
  }

  return Response.json({ queued: queue?.length || 0, sent });
});