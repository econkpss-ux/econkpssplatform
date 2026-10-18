import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const DEFAULT_LINK = "/panel";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function normalizeNotificationLink(link?: string | null): string {
  const candidate = (link ?? DEFAULT_LINK).trim();
  if (!candidate || candidate === "#" || candidate.startsWith("//")) return DEFAULT_LINK;
  if (!candidate.startsWith("/")) return DEFAULT_LINK;
  if (/^(?:javascript:|data:|blob:|about:|mailto:)/i.test(candidate)) return DEFAULT_LINK;
  return candidate;
}

async function run() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const fcmKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !fcmKey) return json({ error: "push not configured" }, 500);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const today = new Date(Date.now() + 3 * 3600_000).toISOString().slice(0, 10);
  const { data: tokens } = await supabaseAdmin.from("push_tokens").select("token, user_id");
  if (!tokens?.length) return json({ ok: true, sent: 0 });
  const userIds = [...new Set(tokens.map((t) => t.user_id))];
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, last_active, streak").in("id", userIds);
  const info = new Map((profiles ?? []).map((p) => [p.id, { streak: p.streak, done: p.last_active === today }]));
  const targets = tokens.filter((t) => info.has(t.user_id));

  const link = normalizeNotificationLink("/panel");
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": fcmKey,
    "Content-Type": "application/json",
  };

  let sent = 0;
  const stale: string[] = [];
  for (let i = 0; i < targets.length; i += 6) {
    await Promise.all(
      targets.slice(i, i + 6).map(async (t) => {
        const { streak, done } = info.get(t.user_id) ?? { streak: 0, done: false };
        const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: done
                ? { title: "🌟 Bugün harikaydın!", body: `${streak} günlük serin güvende. Yatmadan önce 5 soruluk bir tekrar yapmaya ne dersin?` }
                : {
                    title: "🔥 Serini kaybetme!",
                    body: streak > 0 ? `${streak} günlük serin bu gece bitiyor. 5 dakikalık bir turla koru!` : "Bugünkü KPSS görevlerin seni bekliyor. Hadi bir tur at!",
                  },
              webpush: { fcm_options: { link } },
              data: { path: link },
            },
          }),
        });
        if (res.ok) sent++;
        else {
          const body = await res.text();
          if (res.status === 404 || res.status === 400) stale.push(t.token);
          else console.error(`FCM send failed [${res.status}]: ${body}`);
        }
      }),
    );
  }
  if (stale.length) await supabaseAdmin.from("push_tokens").delete().in("token", stale);
  return json({ ok: true, sent, removed: stale.length });
}

export const Route = createFileRoute("/api/public/streak-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["DAILY_CONTENT_SECRET"];
        if (!expected || request.headers.get("x-cron-secret") !== expected) return json({ error: "forbidden" }, 403);
        return run();
      },
    },
  },
});
