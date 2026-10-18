import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-provider";
import { confirmAccountDeletion } from "@/lib/account-deletion.functions";

export const Route = createFileRoute("/account-deletion")({
  component: AccountDeletionPage,
});

function AccountDeletionPage() {
  const confirmDeletion = useServerFn(confirmAccountDeletion);
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<"loading" | "ready" | "confirming" | "confirmed" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const emailToken = new URLSearchParams(url.hash.slice(1)).get("token") ?? "";
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    if (/^[a-f0-9]{64}$/.test(emailToken)) {
      setToken(emailToken);
      setPhase("ready");
    } else {
      setErrorMessage("Doğrulama bağlantısında geçerli bir anahtar bulunamadı.");
      setPhase("error");
    }
  }, []);

  async function onConfirm() {
    setPhase("confirming");
    setErrorMessage("");
    try {
      await confirmDeletion({ data: { token } });
      setToken("");
      setPhase("confirmed");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "E-posta doğrulaması tamamlanamadı.",
      );
      setPhase("error");
    }
  }

  return (
    <main className="canvas-bg flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>
      <section className="bento w-full max-w-lg space-y-6 p-6 text-center sm:p-8">
        <div className="flex justify-center">
          <BrandLogo size="lg" />
        </div>
        {phase === "loading" && (
          <div className="flex justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
        {phase === "ready" && (
          <>
            <AlertTriangle className="mx-auto size-10 text-destructive" />
            <h1 className="text-2xl font-bold">Hesap silme talebini doğrula</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hesabına erişim talep oluşturulduğunda kapatılmıştır. E-posta doğrulamasını
              tamamlayınca kalıcı silme talebin yönetici onayına iletilecek.
            </p>
            <Button variant="destructive" onClick={() => void onConfirm()}>
              <Trash2 className="mr-2 size-4" /> E-postamı doğrula ve talebi gönder
            </Button>
          </>
        )}
        {phase === "confirming" && (
          <div className="space-y-3">
            <Loader2 className="mx-auto size-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Talebin doğrulanıyor…</p>
          </div>
        )}
        {phase === "confirmed" && (
          <>
            <CheckCircle2 className="mx-auto size-10 text-primary" />
            <h1 className="text-2xl font-bold">E-posta adresin doğrulandı</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Hesabın kilitlendi ve silme talebin yönetici ekibine iletildi. Onay sonrasında hesabın
              ve ilişkili verilerin kalıcı olarak kaldırılacak.
            </p>
          </>
        )}
        {phase === "error" && (
          <>
            <AlertTriangle className="mx-auto size-10 text-destructive" />
            <h1 className="text-2xl font-bold">Doğrulama tamamlanamadı</h1>
            <p role="alert" className="text-sm leading-relaxed text-muted-foreground">
              {errorMessage}
            </p>
          </>
        )}
        {phase !== "loading" && phase !== "confirming" && (
          <Link
            to="/auth"
            className="inline-flex text-sm font-semibold text-primary hover:underline"
          >
            Giriş sayfasına dön
          </Link>
        )}
      </section>
    </main>
  );
}
