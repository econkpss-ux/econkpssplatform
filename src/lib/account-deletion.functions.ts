import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const confirmationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
});

async function hashToken(token: string) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(token).digest("hex");
}

export const requestAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (authError || !authData.user?.email || !authData.user.email_confirmed_at) {
      throw new Error("Silme talebi için önce hesabının e-posta adresini doğrulamalısın.");
    }

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (rolesError) throw new Error("Hesap yetkileri doğrulanamadı.");
    if ((roles ?? []).some(({ role }) => role === "super_admin")) {
      throw new Error("Kurucu yönetici hesabı bu yöntemle silinemez.");
    }

    const { data: activeRequest, error: activeRequestError } = await supabaseAdmin
      .from("account_deletion_requests")
      .select("id")
      .eq("user_id", context.userId)
      .in("status", ["pending_verification", "pending_approval"])
      .maybeSingle();
    if (activeRequestError) throw new Error("Mevcut silme talebi kontrol edilemedi.");
    if (activeRequest) {
      throw new Error("Hesabın için zaten işlemde olan bir silme talebi bulunuyor.");
    }
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("deletion_pending")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error("Hesap durumu doğrulanamadı.");
    if (!profile || profile.deletion_pending) {
      throw new Error("Hesap silme talebin zaten işleme alınmış.");
    }

    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    const { data: request, error: insertError } = await supabaseAdmin
      .from("account_deletion_requests")
      .insert({
        user_id: context.userId,
        email: authData.user.email,
        token_hash: await hashToken(token),
        status: "pending_verification",
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (insertError) {
      if (insertError.code === "23505") {
        throw new Error("Hesabın için zaten işlemde olan bir silme talebi bulunuyor.");
      }
      throw new Error(`Silme talebi oluşturulamadı: ${insertError.message}`);
    }

    const { data: lockedProfile, error: lockError } = await supabaseAdmin
      .from("profiles")
      .update({ deletion_pending: true })
      .eq("id", context.userId)
      .select("id")
      .maybeSingle();
    if (lockError || !lockedProfile) {
      const { error: cleanupError } = await supabaseAdmin
        .from("account_deletion_requests")
        .delete()
        .eq("id", request.id);
      if (cleanupError) console.error("Unable to roll back the deletion request.", cleanupError);
      throw new Error("Hesap silme talebi kaydedilemedi. Lütfen tekrar dene.");
    }

    const confirmationUrl = `${
      process.env["APP_URL"]?.replace(/\/+$/, "") ?? "https://econkpss.lovable.app"
    }/account-deletion#token=${token}`;
    try {
      const { sendResendEmail } = await import("@/lib/resend.server");
      await sendResendEmail({
        to: [authData.user.email],
        subject: "EconKPSS hesap silme talebini doğrula",
        text: `Hesap silme talebini doğrulamak için bu bağlantıyı aç: ${confirmationUrl}\n\nTalebi oluşturduğun anda hesabına erişim kapatıldı. E-posta doğrulaması ve yönetici onayından sonra hesap kalıcı olarak silinecek. Bağlantı 24 saat geçerlidir. Talebi sen oluşturmadıysan e-postayı yok say ve yöneticilerle iletişime geç.`,
        html: `<div style="max-width:600px;margin:0 auto;padding:32px 20px;font-family:Arial,sans-serif;color:#172033"><h1 style="font-size:24px">Hesap silme talebini doğrula</h1><p>Talebi oluşturduğun anda hesabına erişim kapatıldı. E-posta doğrulaması ve yönetici onayından sonra hesap kalıcı olarak silinecek.</p><p><a href="${confirmationUrl}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#3a82f7;color:#fff;text-decoration:none;font-weight:700">E-posta adresimi doğrula</a></p><p>Bağlantı 24 saat geçerlidir. Talebi sen oluşturmadıysan e-postayı yok say ve yöneticilerle iletişime geç.</p></div>`,
      });
    } catch (emailError) {
      const { error: unlockError } = await supabaseAdmin
        .from("profiles")
        .update({ deletion_pending: false })
        .eq("id", context.userId);
      const { error: cleanupError } = await supabaseAdmin
        .from("account_deletion_requests")
        .delete()
        .eq("id", request.id);
      if (unlockError || cleanupError) {
        console.error("Unable to roll back a deletion request after email delivery failed.", {
          unlockError,
          cleanupError,
        });
        throw new Error(
          "E-posta gönderilemedi ve talebin geri alınamadı. Yönetici ekibiyle iletişime geç.",
        );
      }
      throw emailError;
    }

    return { ok: true };
  });

export const confirmAccountDeletion = createServerFn({ method: "POST" })
  .validator((input: unknown) => confirmationSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data: request, error: requestError } = await supabaseAdmin
      .from("account_deletion_requests")
      .select("id, user_id")
      .eq("token_hash", await hashToken(data.token))
      .eq("status", "pending_verification")
      .gt("expires_at", now)
      .maybeSingle();
    if (requestError) throw new Error("Doğrulama bağlantısı kontrol edilemedi.");
    if (!request?.user_id) {
      throw new Error("Doğrulama bağlantısı geçersiz veya süresi dolmuş.");
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ deletion_pending: true })
      .eq("id", request.user_id)
      .select("id")
      .maybeSingle();
    if (profileError) throw new Error("Hesap silme durumu güncellenemedi.");
    if (!profile) throw new Error("Hesap bulunamadı; yönetici ekibiyle iletişime geç.");

    const { data: confirmedRequest, error: confirmError } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({ status: "pending_approval", verified_at: now, token_hash: null })
      .eq("id", request.id)
      .eq("status", "pending_verification")
      .select("id")
      .maybeSingle();
    if (confirmError) throw new Error("E-posta doğrulaması tamamlanamadı. Lütfen tekrar dene.");
    if (!confirmedRequest) throw new Error("Bu doğrulama bağlantısı daha önce kullanılmış.");

    return { ok: true };
  });
