import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  Brain,
  Check,
  Clock3,
  Flame,
  Layers,
  ListChecks,
  LineChart,
  LockKeyhole,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-econkpss.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EconKPSS — KPSS hazırlığını oyuna dönüştür" },
      {
        name: "description",
        content:
          "Bilgi kartları, eşleştirme oyunları ve kişisel ilerleme araçlarıyla KPSS çalışma rutinini kendine göre kur.",
      },
      { property: "og:title", content: "EconKPSS — KPSS hazırlığını oyuna dönüştür" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content: "Bilgi kartları, oyunlar ve kişisel ilerleme araçları bir arada.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Layers,
    title: "Bilgi kartları",
    text: "Kısa tekrarlarla önemli bilgileri yeniden gözden geçir.",
    accent: "text-violet-500",
    surface: "bg-violet-500/10",
  },
  {
    icon: Shuffle,
    title: "Eşleştirme oyunları",
    text: "Kavramları ve bilgileri etkileşimli egzersizlerle pekiştir.",
    accent: "text-teal-500",
    surface: "bg-teal-500/10",
  },
  {
    icon: ListChecks,
    title: "Soru bankası",
    text: "Soruları çöz, cevaplarını kontrol et ve konuları tekrar ele al.",
    accent: "text-blue-500",
    surface: "bg-blue-500/10",
  },
  {
    icon: Trophy,
    title: "Rozetler ve seviye",
    text: "Çalışma ilerlemeni görünür kılan küçük motivasyonlar kazan.",
    accent: "text-amber-500",
    surface: "bg-amber-500/10",
  },
  {
    icon: LineChart,
    title: "Kişisel istatistikler",
    text: "Aktivite ve ilerleme bilgilerini kendi panelinden takip et.",
    accent: "text-rose-500",
    surface: "bg-rose-500/10",
  },
];

const STUDY_STEPS = [
  {
    number: "01",
    icon: Target,
    title: "Bir konu seç",
    text: "Çalışmak istediğin dersle başla; bugünün odağını belirle.",
  },
  {
    number: "02",
    icon: Brain,
    title: "Aktif şekilde öğren",
    text: "Kartlar, sorular ve eşleştirmelerle konuyu farklı yollarla tekrar et.",
  },
  {
    number: "03",
    icon: Flame,
    title: "İlerlemene bak",
    text: "Neleri tamamladığını gör ve bir sonraki çalışma adımını seç.",
  },
];

function Landing() {
  return (
    <div id="top" className="canvas-bg min-h-screen overflow-hidden">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="EconKPSS ana sayfa" className="rounded-md">
            <BrandLogo size="md" />
          </Link>
          <nav aria-label="Ana menü" className="hidden items-center gap-8 md:flex">
            <a
              href="#ozellikler"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Özellikler
            </a>
            <a
              href="#nasil-calisir"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Nasıl çalışır?
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth">Giriş yap</Link>
            </Button>
            <Button asChild className="rounded-full px-5 shadow-glow">
              <Link to="/auth">
                Hemen başla <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8 lg:pt-24">
          <div className="pointer-events-none absolute -left-40 top-8 size-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative z-10">
            <h1 className="max-w-2xl text-5xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl">
              KPSS hazırlığını <span className="text-gradient">oyuna</span> dönüştür.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">
              KPSS hazırlığını tekdüze bir rutine dönüştürme. Öğren, kendini dene ve ilerlemeni gör
              — hepsi sana ait bir çalışma alanında.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 rounded-full px-7 text-base shadow-glow">
                <Link to="/auth">
                  Ücretsiz hesap oluştur <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full px-7 text-base"
              >
                <a href="#ozellikler">
                  Platformu keşfet <ArrowDown aria-hidden="true" />
                </a>
              </Button>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Check aria-hidden="true" className="size-4 text-emerald-500" />
                Kendi hızında çalış
              </span>
              <span className="inline-flex items-center gap-2">
                <Check aria-hidden="true" className="size-4 text-emerald-500" />
                İlerlemeni takip et
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl lg:ml-auto">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-violet-500/15 to-teal-400/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card p-2 shadow-lift sm:p-3">
              <img
                src={heroImage}
                alt="Bilgi kartları, soru çözümü ve ilerleme göstergelerini simgeleyen EconKPSS illüstrasyonu"
                width={1280}
                height={960}
                className="aspect-[4/3] w-full rounded-[1.45rem] object-cover"
              />
              <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/50 bg-white/90 p-4 text-slate-900 shadow-xl backdrop-blur-md sm:bottom-7 sm:left-7 sm:right-auto sm:min-w-64">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Check aria-hidden="true" className="size-5" />
                </span>
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Küçük adım, iyi başlangıç
                  </span>
                  <span className="mt-0.5 block font-bold">Bugün de devam ettin.</span>
                </span>
              </div>
            </div>
            <div className="absolute -right-3 -top-5 hidden items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-lift sm:flex lg:-right-6">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Sparkles aria-hidden="true" className="size-4" />
              </span>
              <span className="text-sm font-semibold">Öğrenme, oyunla daha canlı</span>
            </div>
          </div>
        </section>

        <section id="ozellikler" className="scroll-mt-24 border-y border-border/60 bg-card/35">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
                Çalışma alanın
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
                Ezberden fazlası, <span className="text-gradient">sana göre öğrenme.</span>
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
                Farklı çalışma araçlarını bir arada kullan; sana iyi gelen yöntemi bul.
              </p>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-3xl border border-border/70 bg-card p-6 shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift sm:p-7"
                >
                  <span
                    className={`flex size-12 items-center justify-center rounded-2xl ${feature.surface} ${feature.accent}`}
                  >
                    <feature.icon aria-hidden="true" className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
                  <p className="mt-2 leading-6 text-muted-foreground">{feature.text}</p>
                </article>
              ))}
              <article className="flex flex-col justify-between rounded-3xl bg-gradient-to-br from-primary to-violet-600 p-7 text-white shadow-glow sm:p-8">
                <LockKeyhole aria-hidden="true" className="size-6" />
                <div className="mt-10">
                  <h3 className="text-xl font-bold">İlerleme alanın sana özel</h3>
                  <p className="mt-2 leading-6 text-white/80">
                    Çalışma geçmişini ve istatistiklerini hesabından takip et.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section
          id="nasil-calisir"
          className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24"
        >
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div className="lg:sticky lg:top-28">
              <span className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
                Basitçe başla
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">
                Büyük hedefler, <span className="text-gradient">küçük adımlar.</span>
              </h2>
              <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">
                Her şeyi bir günde bitirmek zorunda değilsin. Bir konu seç, çalışmanı yap ve
                gelişimini adım adım takip et.
              </p>
              <Button asChild className="mt-7 h-12 rounded-full px-6 shadow-glow">
                <Link to="/auth">
                  Kendi rutinini kur <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="space-y-4">
              {STUDY_STEPS.map((step) => (
                <article
                  key={step.number}
                  className="flex gap-5 rounded-3xl border border-border/70 bg-card p-5 shadow-soft sm:gap-6 sm:p-7"
                >
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <step.icon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <span className="text-xs font-bold tracking-[0.16em] text-primary">
                      ADIM {step.number}
                    </span>
                    <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
                    <p className="mt-2 leading-6 text-muted-foreground">{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-24">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-violet-600 to-indigo-700 px-6 py-12 text-center text-white shadow-glow sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute -right-20 -top-28 size-72 rounded-full border-[36px] border-white/10" />
            <div className="pointer-events-none absolute -bottom-36 -left-16 size-72 rounded-full border-[36px] border-white/10" />
            <div className="relative mx-auto max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
                <Clock3 aria-hidden="true" className="size-4" />
                Bugün başlamak için doğru zaman
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
                Hazırlığını kendi yolculuğuna dönüştür.
              </h2>
              <p className="mx-auto mt-4 max-w-xl leading-7 text-white/80 sm:text-lg">
                EconKPSS hesabını oluştur, sana uygun araçları keşfet ve ilk çalışma adımını at.
              </p>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="mt-7 h-12 rounded-full bg-white px-7 font-bold text-primary hover:bg-white/90"
              >
                <Link to="/auth">
                  Ücretsiz başla <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card/35">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-7 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Link to="/" aria-label="EconKPSS ana sayfa" className="inline-flex leading-none">
              <img
                src="/econkpss-footer.png"
                alt="EconKPSS"
                width={422}
                height={89}
                className="h-7 w-auto object-contain dark:hidden"
              />
              <img
                src="/econkpss-footer-dark.png"
                alt="EconKPSS"
                width={422}
                height={89}
                className="hidden h-7 w-auto object-contain dark:block"
              />
            </Link>
            <p className="flex flex-wrap items-center justify-center gap-x-2 text-center sm:justify-start sm:text-left">
              © 2026 EconKPSS ·
              <img
                src="/econnotes-footer.png"
                alt="EconNotes"
                width={422}
                height={89}
                className="h-7 w-auto object-contain dark:hidden"
              />
              <img
                src="/econnotes-footer-dark.png"
                alt="EconNotes"
                width={422}
                height={89}
                className="hidden h-7 w-auto object-contain dark:block"
              />
              tarafından geliştirilmiştir.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 sm:items-end">
            <p className="max-w-2xl text-center leading-relaxed sm:text-right">
              Düzce Üniversitesi öğrencileri tarafından geliştirilen, yapay zekâ destekli yeni nesil
              not paylaşım ve çalışma platformu için{" "}
              <a
                href="https://econnotes.online"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline decoration-primary/30 underline-offset-4 transition-colors hover:text-primary"
              >
                tıklayınız
              </a>
              . 💙
            </p>
            <a href="#top" className="font-medium transition-colors hover:text-foreground">
              Başa dön
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
