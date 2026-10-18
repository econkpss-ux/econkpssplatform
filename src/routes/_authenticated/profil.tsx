import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { ConfirmButton } from "@/components/confirm-button";
import { requestAccountDeletion } from "@/lib/account-deletion.functions";
import {
  isMissingDeletionPendingColumn,
  warnDeletionMigrationMissing,
} from "@/lib/account-deletion.compat";

/** "Kaan Çolakoğulları" → "Kaan Ç..." biçiminde soyadı gizler. */
function maskName(value: string | null | undefined) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  return `${parts[0]} ${parts[1]!.charAt(0).toLocaleUpperCase("tr")}...`;
}

export const Route = createFileRoute("/_authenticated/profil")({
  head: () => ({
    meta: [
      { title: "Profilim — EconKPSS" },
      { name: "description", content: "EconKPSS profil bilgilerini görüntüle ve şifreni güncelle." },
      { property: "og:title", content: "Profilim — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Profil bilgilerin ve şifre yönetimi." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const submitDeletionRequest = useServerFn(requestAccountDeletion);
  const [fullName, setFullName] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletionBusy, setDeletionBusy] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-full", user?.id],
    enabled: !!user,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, points, streak, must_change_password, hide_surname, deletion_pending")
        .eq("id", user!.id)
        .maybeSingle();
      if (error && isMissingDeletionPendingColumn(error)) {
        warnDeletionMigrationMissing();
        const { data: legacyProfile, error: legacyError } = await supabase
          .from("profiles")
          .select("full_name, email, points, streak, must_change_password, hide_surname")
          .eq("id", user!.id)
          .maybeSingle();
        if (legacyError) throw legacyError;
        return legacyProfile ? { ...legacyProfile, deletion_pending: false } : null;
      }
      if (error) throw error;
      return data;
    },
  });

  const name = fullName ?? profile?.full_name ?? "";

  async function requestDeletion() {
    if (!user) return;
    setDeletionBusy(true);
    try {
      await submitDeletionRequest({ data: {} });
      toast.success("Doğrulama bağlantısı e-posta adresine gönderildi.");
      await qc.invalidateQueries({ queryKey: ["membership-profile", user.id] });
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error("Deletion requested but the browser session could not sign out.", error);
        toast.error("Talebin alındı. Güvenlik nedeniyle hesabına erişim kapatıldı; çıkış için sayfayı yenile.");
        return;
      }
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Silme talebi oluşturulamadı.");
    } finally {
      setDeletionBusy(false);
    }
  }

  async function saveName() {
    if (!user || name.trim().length < 2) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", user.id);
    setBusy(false);
    if (error) { toast.error("Ad soyad güncellenemedi."); return; }
    toast.success("Profilin güncellendi.");
    qc.invalidateQueries({ queryKey: ["profile-full", user.id] });
  }

  async function toggleHideSurname(next: boolean) {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ hide_surname: next })
      .eq("id", user.id);
    if (error) { toast.error("Ayar kaydedilemedi."); return; }
    toast.success(next ? "Soyadın artık gizli." : "Tam adın görünecek.");
    qc.invalidateQueries({ queryKey: ["profile-full", user.id] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Şifre en az 8 karakter olmalı."); return; }
    if (pw !== pw2) { toast.error("Şifreler eşleşmiyor."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (!error && user) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", user.id);
    }
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPw("");
    setPw2("");
    toast.success("Şifren güncellendi.");
    qc.invalidateQueries({ queryKey: ["profile-full", user?.id] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Profilim</h1>
        <p className="mt-1 text-muted-foreground">Hesap bilgilerini ve şifreni buradan yönet.</p>
      </header>

      {profile?.must_change_password && (
        <div className="bento border-amber/50 bg-amber/10 p-4 text-sm font-medium">
          Yönetici ekibi hesabına geçici bir aktivasyon şifresi tanımladı. Lütfen aşağıdan kendi
          şifreni oluştur.
        </div>
      )}

      <section className="bento p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UserRound className="size-4 text-primary" /> Hesap bilgileri
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fullname">Ad Soyad</Label>
            <Input
              id="fullname"
              value={name}
              maxLength={80}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>E-posta</Label>
            <Input value={profile?.email ?? user?.email ?? ""} disabled />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
          <span>⚡ {profile?.points ?? 0} puan</span>
          <span>🔥 {profile?.streak ?? 0} gün seri</span>
        </div>
        <Button className="mt-4" onClick={saveName} disabled={busy}>
          Kaydet
        </Button>
      </section>

      <section className="bento p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="size-4 text-primary" /> Gizlilik
        </h2>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 accent-[hsl(var(--primary))]"
            checked={profile?.hide_surname ?? true}
            onChange={(e) => void toggleHideSurname(e.target.checked)}
          />
          <span>
            <span className="font-semibold">Liderlik tablosunda soyadım gizlensin</span>
            <span className="block text-muted-foreground">
              Açıkken adın{" "}
              <span className="font-medium">
                {maskName(profile?.full_name ?? name) || "Kaan Ç..."}
              </span>{" "}
              şeklinde görünür. Kapatırsan tam adın görünür.
            </span>
          </span>
        </label>
      </section>

      <section className="bento p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <KeyRound className="size-4 text-primary" /> Şifre oluştur / değiştir
        </h2>
        <form onSubmit={changePassword} className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="np">Yeni şifre</Label>
            <Input
              id="np"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              minLength={8}
              maxLength={72}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="np2">Yeni şifre (tekrar)</Label>
            <Input
              id="np2"
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              minLength={8}
              maxLength={72}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Şifreyi güncelle
            </Button>
          </div>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Şifreni unuttuysan <span className="font-semibold">econkpss@gmail.com</span> adresine
          e-posta gönder; yönetici ekibi sana yeni bir aktivasyon şifresi tanımlayacak.
        </p>
      </section>

      <section className="bento border-destructive/30 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-destructive">
          <Trash2 className="size-4" /> Hesabımı sil
        </h2>
        {profile?.deletion_pending ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Silme talebin işleme alındı. Hesabın yönetici onayı beklerken kilitli kalacaktır.
          </p>
        ) : (
          <>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Talebi oluşturduğunda hesabına erişim hemen kapatılır. E-posta doğrulaması ve
              yönetici ekibinin onayından sonra hesabın ve ilişkili verilerin kalıcı olarak silinir.
            </p>
            <ConfirmButton
              trigger={
                <Button variant="destructive" className="mt-4" disabled={deletionBusy}>
                  {deletionBusy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                  Hesap silme talebi oluştur
                </Button>
              }
              title="Hesap silme talebi oluşturulsun mu?"
              description="E-posta adresine doğrulama bağlantısı gönderilecek ve hesabın hemen kilitlenecek. Doğrulama sonrası talep yönetici onayına iletilir."
              confirmLabel="E-postama doğrulama gönder"
              onConfirm={requestDeletion}
            />
          </>
        )}
      </section>
    </div>
  );
}
