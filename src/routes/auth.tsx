import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { useServerFn } from "@tanstack/react-start";
import { getAccountNotice } from "@/lib/account-notice.functions";
import { ThemeToggle } from "@/components/theme-provider";
import {
  isMissingDeletionPendingColumn,
  warnDeletionMigrationMissing,
} from "@/lib/account-deletion.compat";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Giriş Yap veya Kayıt Ol — EconKPSS" },
      {
        name: "description",
        content: "EconKPSS hesabınla giriş yap, puanlarını ve KPSS ilerlemeni takip et.",
      },
      { property: "og:title", content: "Giriş Yap veya Kayıt Ol — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "EconKPSS'e katıl ve KPSS hazırlığını oyuna dönüştür.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"kadin" | "erkek" | "belirtmek_istemiyorum">(
    "belirtmek_istemiyorum",
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{
    tone: "warn" | "info";
    title: string;
    text: string;
  } | null>(null);
  const accountNotice = useServerFn(getAccountNotice);

  useEffect(() => {
    if (!loading && session && !busy && !notice) navigate({ to: "/panel", replace: true });
  }, [loading, session, busy, notice, navigate]);

  async function showNoticeFor(mail: string) {
    try {
      const res = await accountNotice({ data: { email: mail.trim() } });
      if (res.status === "banned") {
        const until = res.until ? new Date(res.until).toLocaleDateString("tr-TR") : null;
        setNotice({
          tone: "warn",
          title: "Hesabına erişim kısıtlaması uygulandı",
          text: `${res.reason ? `Sebep: ${res.reason}. ` : "Yönetici ekibi hesabını geçici olarak kısıtladı. "}${
            until ? `Kısıtlama ${until} tarihine kadar sürüyor. ` : ""
          }İtiraz için econkpss@gmail.com adresine yazabilirsin.`,
        });
        return true;
      }
      if (res.status === "pending") {
        setNotice({
          tone: "info",
          title: "Üyeliğin yönetici onayı bekliyor",
          text: "Kaydın alındı. Yönetici ekibi hesabını onayladığında giriş yapabilirsin. Onay sonrası e-postana bildirim gelmezse econkpss@gmail.com adresinden bize ulaşabilirsin.",
        });
        return true;
      }
    } catch {
      /* bilgi mesajı alınamazsa sessiz geç */
    }
    return false;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "login") {
        const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          await showNoticeFor(email);
          throw error;
        }
        if (!signIn.user) throw new Error("Giriş tamamlanamadı. Tekrar dene.");
        let { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("approved, deletion_pending")
          .eq("id", signIn.user.id)
          .maybeSingle();
        if (profileError && isMissingDeletionPendingColumn(profileError)) {
          warnDeletionMigrationMissing();
          const fallback = await supabase
            .from("profiles")
            .select("approved")
            .eq("id", signIn.user.id)
            .maybeSingle();
          profile = fallback.data ? { ...fallback.data, deletion_pending: false } : null;
          profileError = fallback.error;
        }
        if (profileError) throw profileError;
        if (profile?.deletion_pending) {
          await supabase.auth.signOut();
          setNotice({
            tone: "info",
            title: "Hesap silme talebin incelemede",
            text: "E-posta doğrulaması tamamlandı. Yönetici ekibi talebini sonuçlandırana kadar hesabına erişim kapalıdır.",
          });
          return;
        }
        if (profile && profile.approved === false) {
          await supabase.auth.signOut();
          setNotice({
            tone: "info",
            title: "Üyeliğin yönetici onayı bekliyor",
            text: "Hesabın oluşturuldu ancak henüz yönetici onayı verilmedi. Onaylandığında bu ekrandan giriş yapabilirsin.",
          });
          return;
        }
        toast.success("Tekrar hoş geldin!");
        navigate({ to: "/panel", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, gender },
          },
        });
        if (error) throw error;
        // Yeni üyelikler yönetici onayından sonra aktifleşir.
        if (data.session) await supabase.auth.signOut();
        setMode("login");
        setNotice({
          tone: "info",
          title: "Kaydın alındı, onay bekleniyor",
          text: "Yönetici ekibi kaydınızı onayladıktan sonra platforma erişeceksiniz. E-posta doğrulama bağlantısı gönderildiyse önce e-postanızı doğrulayın.",
        });
        toast.success("Kaydın alındı, yönetici onayı bekleniyor.");
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "";
      const map: Record<string, string> = {
        "Invalid login credentials": "E-posta veya şifre hatalı.",
        "Email not confirmed": "E-postanı doğrulaman gerekiyor.",
        "User already registered": "Bu e-posta ile zaten bir hesap var. Giriş yapabilirsin.",
      };
      const friendly = raw.toLowerCase().includes("weak")
        ? "Bu şifre çok yaygın ve güvensiz. Daha güçlü bir şifre seç."
        : raw.toLowerCase().includes("invalid") && raw.toLowerCase().includes("email")
          ? "Geçerli bir e-posta adresi gir."
          : map[raw];
      toast.error(friendly ?? raw ?? "Bir hata oluştu");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="canvas-bg relative flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-16">
        <section className="hidden space-y-12 lg:block">
          <Link to="/" className="inline-flex">
            <BrandLogo size="lg" />
          </Link>

          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="size-4" />
              KPSS hazırlığında yeni dönem
            </span>
            <h1 className="max-w-xl text-5xl font-black leading-[1.12] tracking-tight xl:text-6xl">
              Her gün biraz daha <span className="text-primary">ileri.</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
              Bilgi kartları, eğlenceli eşleştirmeler ve soru bankasıyla hedeflerine kendi temponda
              yaklaş.
            </p>
          </div>

          <div className="grid max-w-lg gap-3">
            {[
              "İlerlemeni tek yerden takip et",
              "Kısa tekrarlarla çalışma serini koru",
              "Gelişimini puan ve başarılarla gör",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm font-medium">
                <span className="flex size-8 items-center justify-center rounded-full bg-mint/20 text-primary">
                  <CheckCircle2 className="size-4" />
                </span>
                {item}
              </div>
            ))}
          </div>

          <div className="flex max-w-lg items-center gap-4 rounded-2xl border border-border/70 bg-background/65 p-4 backdrop-blur">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpenCheck className="size-6" />
            </span>
            <div>
              <p className="font-semibold">Bugün küçük bir adım at</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Düzenli tekrar, büyük hedeflere giden yolu açar.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="mb-6 flex justify-center lg:hidden">
            <Link to="/" aria-label="EconKPSS ana sayfa">
              <BrandLogo size="lg" />
            </Link>
          </div>

          <div className="bento rounded-[1.75rem] p-6 shadow-lift sm:p-9">
            <div className="mb-7 grid grid-cols-2 rounded-xl bg-secondary/80 p-1">
              {(["login", "register"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={mode === item}
                  disabled={busy}
                  onClick={() => setMode(item)}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition-all ${
                    mode === item
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {item === "login" ? "Giriş yap" : "Kayıt ol"}
                </button>
              ))}
            </div>

            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight">
                {mode === "login" ? "Tekrar hoş geldin" : "Aramıza katıl"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {mode === "login"
                  ? "Hesabına giriş yap ve kaldığın yerden devam et."
                  : "Ücretsiz hesabını oluştur, KPSS yolculuğuna başla."}
              </p>
            </div>

            {notice && (
              <div
                className={`mb-6 rounded-xl border p-4 text-sm ${
                  notice.tone === "warn"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-primary/30 bg-primary/10 text-foreground"
                }`}
                role="status"
              >
                <p className="flex items-center gap-2 font-semibold">
                  {notice.tone === "warn" ? (
                    <ShieldAlert className="size-4" />
                  ) : (
                    <Info className="size-4 text-primary" />
                  )}
                  {notice.title}
                </p>
                <p className="mt-1 leading-relaxed">{notice.text}</p>
              </div>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Ad Soyad</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    className="h-11 rounded-xl bg-background/70"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={80}
                    required
                  />
                </div>
              )}

              {mode === "register" && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Cinsiyet</legend>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { v: "kadin", l: "Kadın" },
                        { v: "erkek", l: "Erkek" },
                        { v: "belirtmek_istemiyorum", l: "Belirtmek istemiyorum" },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.v}
                        type="button"
                        aria-pressed={gender === option.v}
                        onClick={() => setGender(option.v)}
                        className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${
                          gender === option.v
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {option.l}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="h-11 rounded-xl bg-background/70"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={255}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    className="h-11 rounded-xl bg-background/70 pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    maxLength={72}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="h-12 w-full rounded-xl text-base shadow-glow"
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {mode === "login"
                      ? "Giriş yapılıyor, lütfen bekleyiniz…"
                      : "Kayıt oluşturuluyor, lütfen bekleyiniz…"}
                  </>
                ) : (
                  <>
                    {mode === "login" ? "Giriş yap" : "Ücretsiz hesap oluştur"}
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 rounded-xl bg-secondary/70 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">Şifreni mi unuttun?</p>
              <p className="mt-1">
                <span className="font-medium text-foreground">econkpss@gmail.com</span> adresine
                yaz; yönetici ekibi yeni aktivasyon şifresi oluştursun. Giriş yaptıktan sonra
                profilinden kendi şifreni belirleyebilirsin.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
