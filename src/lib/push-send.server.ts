const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";
const DEFAULT_LINK = "/panel";

function normalizeNotificationLink(link?: string | null): string {
  const candidate = (link ?? DEFAULT_LINK).trim();
  if (!candidate || candidate === "#" || candidate.startsWith("//")) return DEFAULT_LINK;
  if (!candidate.startsWith("/")) return DEFAULT_LINK;
  if (/^(?:javascript:|data:|blob:|about:|mailto:)/i.test(candidate)) return DEFAULT_LINK;
  return candidate;
}

export type PushSendResult = {
  sent: number;
  failed: number;
  reason?: "not-configured" | "no-registered-devices";
  missingConfig?: string[];
};

/** Kayıtlı cihazlara web bildirimi gönderir. userIds verilmezse herkese gider. */
export async function sendPush(opts: {
  title: string;
  body: string;
  link?: string;
  userIds?: string[];
}): Promise<PushSendResult> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const fcmKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  const missingConfig = [
    ...(!lovableKey ? ["LOVABLE_API_KEY"] : []),
    ...(!fcmKey ? ["FIREBASE_MESSAGING_API_KEY"] : []),
  ];
  if (missingConfig.length) {
    return { sent: 0, failed: 0, reason: "not-configured", missingConfig };
  }

  const link = normalizeNotificationLink(opts.link);
  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": fcmKey,
    "Content-Type": "application/json",
  };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("push_tokens").select("token");
  if (opts.userIds) q = q.in("user_id", opts.userIds);
  const { data: tokens, error } = await q;
  if (error) throw new Error(`Push cihaz kayıtları alınamadı: ${error.message}`);
  if (!tokens?.length) {
    return { sent: 0, failed: 0, reason: "no-registered-devices" };
  }

  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  for (let i = 0; i < tokens.length; i += 6) {
    await Promise.all(
      tokens.slice(i, i + 6).map(async ({ token }) => {
        const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: {
              token,
              notification: { title: opts.title.slice(0, 120), body: opts.body.slice(0, 300) },
              webpush: { fcm_options: { link } },
              data: { path: link },
            },
          }),
        });

        if (res.ok) sent++;
        else {
          const txt = await res.text();
          failed++;
          if (res.status === 404) stale.push(token);
          console.error(`FCM send failed [${res.status}]: ${txt}`);
        }
      }),
    );
  }

  if (stale.length) {
    const { error: deleteError } = await supabaseAdmin
      .from("push_tokens")
      .delete()
      .in("token", stale);
    if (deleteError)
      throw new Error(`Geçersiz push tokenları temizlenemedi: ${deleteError.message}`);
  }
  return { sent, failed };
}
