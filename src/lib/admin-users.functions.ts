import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type AdminSupabaseClient = SupabaseClient<Database>;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (error || !data) throw new Error("Bu işlem için yönetici yetkisi gerekiyor.");
}

const idSchema = z.object({ userId: z.string().uuid() });
const deletionRequestSchema = z.object({ requestId: z.string().uuid() });

async function deleteAccountAndData(
  supabaseAdmin: AdminSupabaseClient,
  userId: string,
  reviewedBy: string,
) {
  const { data: targetRoles, error: rolesError } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rolesError) throw new Error(`Kullanıcı yetkileri kontrol edilemedi: ${rolesError.message}`);
  if ((targetRoles ?? []).some(({ role }) => role === "super_admin")) {
    throw new Error("Kurucu yönetici hesabı silinemez.");
  }

  const cleanup = [
    supabaseAdmin.from("progress_events").delete().eq("user_id", userId),
    supabaseAdmin.from("content_reports").delete().eq("user_id", userId),
    supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
    supabaseAdmin.from("user_messages").delete().eq("user_id", userId),
    supabaseAdmin.from("user_messages").update({ sender_id: null }).eq("sender_id", userId),
    supabaseAdmin.from("push_tokens").delete().eq("user_id", userId),
    supabaseAdmin.from("announcements").update({ created_by: null }).eq("created_by", userId),
    supabaseAdmin.from("pending_content").update({ reviewed_by: null }).eq("reviewed_by", userId),
  ];
  for (const step of cleanup) {
    const { error } = await step;
    if (error) throw new Error(`Kullanıcı verileri temizlenemedi: ${error.message}`);
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").delete().eq("id", userId);
  if (profileError) throw new Error(`Profil silinemedi: ${profileError.message}`);

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError && !/not.?found/i.test(deleteError.message)) {
    throw new Error(`Hesap silinemedi: ${deleteError.message}`);
  }
  const { data: check, error: checkError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (check?.user) throw new Error("Hesap silinemedi, lütfen tekrar deneyin.");
  if (checkError && !/not.?found/i.test(checkError.message)) {
    throw new Error(`Hesabın silindiği doğrulanamadı: ${checkError.message}`);
  }

  const { data: deletionRequests, error: requestReadError } = await supabaseAdmin
    .from("account_deletion_requests")
    .select("id, status")
    .eq("user_id", userId);
  if (requestReadError) {
    throw new Error(`Silme geçmişi anonimleştirilemedi: ${requestReadError.message}`);
  }
  for (const request of deletionRequests ?? []) {
    const wasOpen = request.status === "pending_verification" || request.status === "pending_approval";
    const now = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({
        user_id: null,
        email: null,
        token_hash: null,
        ...(wasOpen
          ? {
              status: "completed",
              reviewed_at: now,
              reviewed_by: reviewedBy,
              completed_at: now,
            }
          : {}),
      })
      .eq("id", request.id)
      .eq("user_id", userId);
    if (error) throw new Error(`Silme geçmişi anonimleştirilemedi: ${error.message}`);
  }
}

/** Kimlik bilgilerini yalnızca doğrulanmış yönetici değiştirebilir. */
export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; fullName: string; email: string }) =>
    idSchema.extend({ fullName: z.string().trim().min(2).max(80), email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: founder, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: data.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error("Kullanıcı yetkisi doğrulanamadı.");
    if (founder && data.userId !== context.userId) {
      throw new Error("Kurucu yöneticinin bilgilerini yalnızca kendisi değiştirebilir.");
    }
    const { data: profile, error: readError } = await context.supabase.from("profiles").select("id").eq("id", data.userId).maybeSingle();
    if (readError || !profile) throw new Error("Kullanıcı bulunamadı.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: previous, error: userError } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (userError || !previous.user) throw new Error("Hesap bulunamadı.");
    const email = data.email.toLowerCase();
    const oldUser = previous.user;
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ...(email !== oldUser.email?.toLowerCase() ? { email } : {}),
      user_metadata: { ...oldUser.user_metadata, full_name: data.fullName },
    });
    if (authError) throw new Error(/already|registered|exists/i.test(authError.message) ? "Bu e-posta başka bir hesap tarafından kullanılıyor." : authError.message);
    const { error } = await context.supabase.from("profiles").update({ full_name: data.fullName, email }).eq("id", data.userId);
    if (error) {
      await supabaseAdmin.auth.admin.updateUserById(data.userId, { ...(oldUser.email ? { email: oldUser.email } : {}), user_metadata: oldUser.user_metadata });
      throw new Error("Bilgiler kaydedilemedi; lütfen tekrar deneyin.");
    }
    return { ok: true };
  });

/** Yönetici onayından sonra yeni üyeye erişim açar. */
export const adminApproveUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ approved: true, approved_at: new Date().toISOString(), approved_by: context.userId })
      .eq("id", data.userId)
      .eq("approved", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Yönetici, seçtiği kullanıcıya özel mesaj gönderir. */
export const adminSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; subject: string; body: string }) =>
    idSchema.extend({ subject: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: recipient, error: recipientError } = await context.supabase
      .from("profiles").select("id").eq("id", data.userId).maybeSingle();
    if (recipientError || !recipient) throw new Error("Kullanıcı bulunamadı.");
    const { error } = await context.supabase.from("user_messages").insert({
      user_id: data.userId, sender_id: context.userId, subject: data.subject, body: data.body,
    });
    if (error) throw new Error(error.message);
    try {
      const { sendPush } = await import("@/lib/push-send.server");
      await sendPush({ title: `✉️ ${data.subject}`, body: data.body, link: "/mesajlar", userIds: [data.userId] });
    } catch (e) { console.error(e); }
    return { ok: true };
  });

/** Duyuruyu tüm bildirim açık cihazlara web bildirimi olarak iletir. */
export const adminPushAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; body: string }) =>
    z.object({ title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sendPush } = await import("@/lib/push-send.server");
    return sendPush({ title: `📢 ${data.title}`, body: data.body, link: "/panel" });
  });

/** Yöneticinin kendi cihazlarına deneme bildirimi gönderir. */
export const adminTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { sendPush } = await import("@/lib/push-send.server");
    return sendPush({ title: "🔔 EconKPSS deneme", body: "Bu bildirimi görüyorsan cihazın hazır!", userIds: [context.userId] });
  });

/** Kullanıcıya yönetici tarafından yeni bir aktivasyon şifresi tanımlar. */
export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; password: string }) =>
    idSchema.extend({ password: z.string().min(8).max(72) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: founder, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: data.userId,
      _role: "super_admin",
    });
    if (roleError) throw new Error("Kullanıcı yetkisi doğrulanamadı.");
    if (founder && data.userId !== context.userId) {
      throw new Error("Kurucu yöneticinin parolasını yalnızca kendisi değiştirebilir.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.userId);
    return { ok: true };
  });

/** Kullanıcıya süreli erişim cezası verir. */
export const adminBanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; days: number; reason: string }) =>
    idSchema
      .extend({ days: z.number().int().min(1).max(3650), reason: z.string().trim().max(300) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Kendinize ceza veremezsiniz.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: `${data.days * 24}h`,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({
        banned_until: new Date(Date.now() + data.days * 86400000).toISOString(),
        ban_reason: data.reason || null,
      })
      .eq("id", data.userId);
    return { ok: true };
  });

/** Kullanıcının cezasını kaldırır. */
export const adminUnbanUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: "none",
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ banned_until: null, ban_reason: null })
      .eq("id", data.userId);
    return { ok: true };
  });

/** Kullanıcı hesabını ve tüm verilerini kalıcı olarak siler. */
export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => idSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Kendi hesabınızı silemezsiniz.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await deleteAccountAndData(supabaseAdmin, data.userId, context.userId);
    return { ok: true };
  });

/** E-posta doğrulaması yapılmış bir hesap silme talebini onaylar. */
export const adminApproveAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => deletionRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request, error: requestError } = await supabaseAdmin
      .from("account_deletion_requests")
      .select("id, user_id, status")
      .eq("id", data.requestId)
      .eq("status", "pending_approval")
      .maybeSingle();
    if (requestError) throw new Error(`Silme talebi alınamadı: ${requestError.message}`);
    if (!request?.user_id) throw new Error("Bu talep onay için artık uygun değil.");
    if (request.user_id === context.userId) throw new Error("Kendi hesabınızı bu işlemle silemezsiniz.");

    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({ status: "completed", reviewed_at: new Date().toISOString(), reviewed_by: context.userId })
      .eq("id", request.id)
      .eq("status", "pending_approval")
      .select("id")
      .maybeSingle();
    if (claimError) throw new Error(`Silme talebi onaylanamadı: ${claimError.message}`);
    if (!claimed) throw new Error("Talep başka bir yönetici tarafından işleme alındı.");

    try {
      await deleteAccountAndData(supabaseAdmin, request.user_id, context.userId);
    } catch (error) {
      const { error: rollbackError } = await supabaseAdmin
        .from("account_deletion_requests")
        .update({ status: "pending_approval", reviewed_at: null, reviewed_by: null })
        .eq("id", request.id)
        .eq("user_id", request.user_id)
        .eq("status", "completed");
      if (rollbackError) {
        console.error("Unable to restore the account deletion request after approval failed.", rollbackError);
      }
      throw error;
    }

    const { error: completedError } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", request.id);
    if (completedError) {
      throw new Error(`Hesap silindi ancak talebin tamamlanma kaydı güncellenemedi: ${completedError.message}`);
    }
    return { ok: true };
  });

/** Silme talebini reddeder ve hesabın erişimini yeniden açar. */
export const adminRejectAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => deletionRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: request, error: requestError } = await supabaseAdmin
      .from("account_deletion_requests")
      .select("id, user_id, email, status, token_hash")
      .eq("id", data.requestId)
      .in("status", ["pending_verification", "pending_approval"])
      .maybeSingle();
    if (requestError) throw new Error(`Silme talebi alınamadı: ${requestError.message}`);
    if (!request?.user_id) throw new Error("Bu talep reddetmek için artık uygun değil.");

    const { data: rejected, error: rejectError } = await supabaseAdmin
      .from("account_deletion_requests")
      .update({
        status: "rejected",
        user_id: null,
        email: null,
        token_hash: null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      })
      .eq("id", request.id)
      .eq("status", request.status)
      .select("id")
      .maybeSingle();
    if (rejectError) throw new Error(`Silme talebi reddedilemedi: ${rejectError.message}`);
    if (!rejected) throw new Error("Talep başka bir yönetici tarafından işleme alındı.");

    const { data: unlockedProfile, error: unlockError } = await supabaseAdmin
      .from("profiles")
      .update({ deletion_pending: false })
      .eq("id", request.user_id)
      .select("id")
      .maybeSingle();
    if (unlockError || !unlockedProfile) {
      const { error: rollbackError } = await supabaseAdmin
        .from("account_deletion_requests")
        .update({
          status: request.status,
          user_id: request.user_id,
          email: request.email,
          token_hash: request.token_hash,
          reviewed_at: null,
          reviewed_by: null,
        })
        .eq("id", request.id)
        .eq("status", "rejected");
      if (rollbackError) {
        console.error("Unable to restore a rejected account deletion request after unlocking failed.", rollbackError);
      }
      throw new Error(`Hesap erişimi yeniden açılamadı: ${unlockError?.message ?? "Profil bulunamadı."}`);
    }
    return { ok: true };
  });
