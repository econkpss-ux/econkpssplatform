import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Wrench } from "lucide-react";
import { useSession, useRoles } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getSiteSettings, SITE_SETTINGS_QUERY_KEY, type SiteSettings } from "@/lib/site-settings";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EconKPSS — Oyunlaştırılmış KPSS Hazırlık Platformu" },
      {
        name: "description",
        content:
          "EconKPSS ile bilgi kartları, eşleştirme oyunları ve oyunlaştırılmış soru bankası kullanarak KPSS'ye eğlenerek hazırlan.",
      },
      { name: "author", content: "EconKPSS" },
      { property: "og:title", content: "EconKPSS — Oyunlaştırılmış KPSS Hazırlık Platformu" },
      {
        property: "og:description",
        content: "KPSS hazırlığını oyuna dönüştüren yeni nesil eğitim platformu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#3a82f7" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "EconKPSS" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png?v=3", type: "image/png", sizes: "64x64" },
      { rel: "manifest", href: "/manifest.webmanifest?v=4" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=4", sizes: "180x180" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <MaintenanceGate>
          <Outlet />
        </MaintenanceGate>
        <Toaster position="top-center" richColors />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function isSiteSettings(value: unknown): value is SiteSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Record<string, unknown>;
  return (
    settings["id"] === 1 &&
    typeof settings["maintenance_enabled"] === "boolean" &&
    typeof settings["maintenance_title"] === "string" &&
    typeof settings["maintenance_message"] === "string" &&
    typeof settings["updated_at"] === "string"
  );
}

function MaintenanceGate({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { user } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { isAdmin, loading: rolesLoading } = useRoles(user);
  const { data, isError, error } = useQuery({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: getSiteSettings,
  });

  useEffect(() => {
    if (isError) {
      console.error("Unable to load maintenance settings; site access remains enabled.", error);
    }
  }, [error, isError]);

  useEffect(() => {
    const channel = supabase
      .channel("site-maintenance-status")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_settings", filter: "id=eq.1" },
        (payload) => {
          if (!isSiteSettings(payload.new)) {
            console.error("Received invalid live maintenance settings.", payload.new);
            return;
          }
          queryClient.setQueryData(SITE_SETTINGS_QUERY_KEY, payload.new);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`Live maintenance status subscription failed: ${status}.`);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (!user && pathname === "/auth") return children;

  if (isError) return children;

  if (isPending || !data) {
    return (
      <MaintenanceMessage
        title="Erişim kontrol ediliyor"
        message="Site durumunu kontrol ediyoruz. Lütfen kısa bir süre bekleyin."
      />
    );
  }

  if (!data.maintenance_enabled) return children;

  if (rolesLoading) {
    return (
      <MaintenanceMessage
        title="Erişim kontrol ediliyor"
        message="Hesap yetkinizi kontrol ediyoruz. Lütfen kısa bir süre bekleyin."
      />
    );
  }

  if (isAdmin) return children;

  return <MaintenanceMessage title={data.maintenance_title} message={data.maintenance_message} />;
}

function MaintenanceMessage({
  title,
  message,
  onRetry,
  retryLabel,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <main className="canvas-bg flex min-h-dvh items-center justify-center px-5 py-12">
      <section className="bento w-full max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Wrench className="size-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">{title}</h1>
        <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{message}</p>
        {onRetry && retryLabel && (
          <Button className="mt-6" onClick={onRetry}>
            {retryLabel}
          </Button>
        )}
      </section>
    </main>
  );
}
