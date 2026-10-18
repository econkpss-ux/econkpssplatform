import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { AppLoading } from "@/components/app-loading";
import { StreakReminder } from "@/components/streak-reminder";
import { ThemeToggle } from "@/components/theme-provider";
import {
  isMissingDeletionPendingColumn,
  warnDeletionMigrationMissing,
} from "@/lib/account-deletion.compat";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  LayoutGrid,
  Layers,
  Shuffle,
  ListChecks,
  Trophy,
  Shield,
  LogOut,
  Menu,
  X,
  UserRound,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/panel", label: "Panel", icon: LayoutGrid },
  { to: "/kartlar", label: "Bilgi Kartları", icon: Layers },
  { to: "/eslestirme", label: "Eşleştirme", icon: Shuffle },
  { to: "/sorular", label: "Soru Bankası", icon: ListChecks },
  { to: "/liderlik", label: "Liderlik", icon: Trophy },
  { to: "/mesajlar", label: "Mesajlarım", icon: Mail },
  { to: "/profil", label: "Profilim", icon: UserRound },
] as const;

function AuthenticatedLayout() {
  const { session, user, loading } = useSession();
  const { isAdmin, loading: rolesLoading } = useRoles(user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { data: profile, isPending: profileLoading, isError: profileError, refetch: reloadProfile } = useQuery({
    queryKey: ["membership-profile", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, points, approved, last_active, deletion_pending")
        .eq("id", user.id)
        .maybeSingle();
      if (error && isMissingDeletionPendingColumn(error)) {
        warnDeletionMigrationMissing();
        const { data: legacyProfile, error: legacyError } = await supabase
          .from("profiles")
          .select("full_name, points, approved, last_active")
          .eq("id", user.id)
          .maybeSingle();
        if (legacyError) throw legacyError;
        return legacyProfile ? { ...legacyProfile, deletion_pending: false } : null;
      }
      if (error) throw error;
      return data;
    },
  });

  const displayName =
    profile?.full_name ??
    (user?.user_metadata?.["full_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "";

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth", replace: true });
  }, [loading, session, navigate]);

  const { data: unread } = useQuery({
    queryKey: ["unread-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase
        .from("user_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Çıkış başarıyla yapıldı.");
      navigate({ to: "/auth", replace: true });
    } catch (error) {
      console.error("Unable to sign out.", error);
      toast.error(
        `Çıkış yapılamadı: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`,
      );
      setSigningOut(false);
    }
  }

  if (signingOut) return <AppLoading label="Çıkış yapılıyor, lütfen bekleyiniz…" />;

  if (loading || !session || profileLoading || rolesLoading) {
    return <AppLoading />;
  }

  if (profile?.deletion_pending) {
    return (
      <main className="canvas-bg flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center"><BrandLogo size="lg" /></div>
          <h1 className="text-2xl font-bold">Hesap silme talebin incelemede</h1>
          <p className="leading-relaxed text-muted-foreground">
            E-posta doğrulaması tamamlandı. Yönetici ekibi talebini sonuçlandırana kadar hesabına
            erişim kapalıdır. Talebin reddedilirse hesabın yeniden açılır.
          </p>
          <Button variant="outline" onClick={() => void signOut()}>Giriş ekranına dön</Button>
          <div className="flex justify-center"><ThemeToggle /></div>
        </div>
      </main>
    );
  }

  if (profileError || (!isAdmin && !profile?.approved)) {
    return (
      <main className="canvas-bg flex min-h-dvh items-center justify-center px-5 py-12">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center"><BrandLogo size="lg" /></div>
          <h1 className="text-2xl font-bold">{profileError ? "Üyelik bilgisi alınamadı" : "Üyeliğiniz onay bekliyor"}</h1>
          <p className="leading-relaxed text-muted-foreground">{profileError ? "Şu anda üyelik durumunuzu kontrol edemedik. Lütfen tekrar deneyin." : "Yönetici ekibi kaydınızı onayladıktan sonra platforma erişeceksiniz."}</p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => void reloadProfile()}>Durumu kontrol et</Button>
            <Button variant="outline" onClick={() => void signOut()}>Giriş ekranına dön</Button>
          </div>
          <div className="flex justify-center"><ThemeToggle /></div>
        </div>
      </main>
    );
  }

  const links = [
    ...NAV,
    ...(isAdmin ? [{ to: "/admin", label: "Yönetim", icon: Shield } as const] : []),
  ];

  return (
    <div className="canvas-bg min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto grid h-16 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-1 px-3 sm:flex sm:justify-between sm:gap-3 sm:px-4">
          <Link to="/panel" className="min-w-0">
            <BrandLogo size="md" />
          </Link>
          <div className="flex shrink-0 items-center gap-0 sm:gap-2">
            <span className="hidden max-w-48 truncate text-sm font-semibold md:inline">
              Merhaba, <span className="text-primary">{displayName}</span>
            </span>
            {typeof profile?.points === "number" && (
              <span className="hidden items-center gap-1 rounded-full bg-amber/20 px-2.5 py-1 text-xs font-bold sm:inline-flex">
                ⚡ {profile.points} puan
              </span>
            )}
            <StreakReminder />
            <ThemeToggle />
            <Button variant="ghost" size="icon" aria-label="Çıkış yap" title="Çıkış yap" onClick={() => { setOpen(false); setConfirmOut(true); }}>
              <LogOut className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Menü"
            >
              {open ? <X className="size-4" /> : <Menu className="size-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6">
        <aside
           className={`${open ? "block" : "hidden"} fixed inset-x-4 top-20 z-30 max-h-[calc(100dvh-6rem)] overflow-y-auto lg:static lg:block lg:max-h-none lg:w-60 lg:shrink-0 lg:overflow-visible`}
        >
          <nav className="bento space-y-1 p-2 lg:sticky lg:top-24">
            {links.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <item.icon className="size-4" />
                  {item.label}
                  {item.to === "/mesajlar" && (unread ?? 0) > 0 && (
                    <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground">
                      {unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <AlertDialog open={confirmOut} onOpenChange={setConfirmOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>EconKPSS'den ayrılıyorsunuz, emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Çıkış yaparsan çalışma serin duraklar. Puanların ve ilerlemen kayıtlı kalır, dilediğin
              zaman geri dönebilirsin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç, çalışmaya devam</AlertDialogCancel>
            <AlertDialogAction onClick={signOut}>Evet, çıkış yap</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}