import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function dateInIstanbul(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values["year"]}-${values["month"]}-${values["day"]}`;
}

function matchesSecret(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  );
}

async function countResult(
  result: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  label: string,
) {
  const { count, error } = await result;
  if (error) throw new Error(`Daily summary could not count ${label}: ${error.message}`);
  if (count === null) throw new Error(`Daily summary returned no count for ${label}.`);
  return count;
}

async function sendDailySummary() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const today = dateInIstanbul(new Date());
  const reportDate = dateInIstanbul(
    new Date(new Date(`${today}T00:00:00+03:00`).getTime() - 86_400_000),
  );
  const start = new Date(`${reportDate}T00:00:00+03:00`).toISOString();
  const end = new Date(new Date(start).getTime() + 86_400_000).toISOString();

  const [newMembers, activeMembers, studyEvents, pendingMemberships, pendingContent] =
    await Promise.all([
      countResult(
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", start)
          .lt("created_at", end),
        "new members",
      ),
      countResult(
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("last_active", reportDate),
        "active members",
      ),
      countResult(
        supabaseAdmin
          .from("progress_events")
          .select("id", { count: "exact", head: true })
          .gte("created_at", start)
          .lt("created_at", end),
        "study events",
      ),
      countResult(
        supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("approved", false),
        "pending memberships",
      ),
      countResult(
        supabaseAdmin
          .from("pending_content")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        "pending content",
      ),
    ]);

  const { data: adminRoles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"]);
  if (rolesError) throw new Error(`Administrator roles could not be loaded: ${rolesError.message}`);

  const userIds = [...new Set((adminRoles ?? []).map(({ user_id }) => user_id))];
  const recipients = new Set(["kaancolakogullari1@gmail.com"]);
  if (userIds.length) {
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .in("id", userIds)
      .not("email", "is", null);
    if (adminsError)
      throw new Error(`Administrator emails could not be loaded: ${adminsError.message}`);
    for (const admin of admins ?? []) {
      if (admin.email?.trim()) recipients.add(admin.email.trim());
    }
  }

  const metrics = [
    ["Yeni üyeler", newMembers],
    ["Günlük aktif kullanıcılar", activeMembers],
    ["Çalışma etkinlikleri", studyEvents],
    ["Onay bekleyen üyelikler", pendingMemberships],
    ["Onay bekleyen içerikler", pendingContent],
  ];
  const rows = metrics
    .map(
      ([label, count]) =>
        `<tr><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb">${label}</td><td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${count}</td></tr>`,
    )
    .join("");
  const text = [
    `EconKPSS Günlük Özet — ${reportDate}`,
    "",
    ...metrics.map(([label, count]) => `${label}: ${count}`),
  ].join("\n");
  const html = `<div style="max-width:600px;margin:0 auto;padding:32px 20px;font-family:Arial,sans-serif;color:#172033"><h1 style="font-size:24px">EconKPSS Günlük Özet</h1><p style="color:#64748b">${reportDate} günü platform özeti</p><table style="width:100%;border-collapse:collapse">${rows}</table><p style="margin-top:24px;color:#64748b;font-size:12px">Bu otomatik günlük platform raporudur.</p></div>`;

  const { sendResendEmail } = await import("@/lib/resend.server");
  await sendResendEmail({
    to: [...recipients],
    subject: "EconKPSS Günlük Özet",
    html,
    text,
  });

  return { reportDate, recipientCount: recipients.size };
}

export const Route = createFileRoute("/api/public/daily-summary")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (
          !matchesSecret(
            request.headers.get("x-daily-summary-secret"),
            process.env["DAILY_SUMMARY_SECRET"],
          )
        ) {
          return json({ error: "forbidden" }, 403);
        }

        try {
          return json(await sendDailySummary());
        } catch (error) {
          console.error("Daily administrator summary failed.", error);
          return json({ error: "Daily summary could not be sent." }, 500);
        }
      },
    },
  },
});
