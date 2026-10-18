import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, levelFromPoints } from "@/lib/auth";
import { subjectsQuery } from "@/lib/econ";
import { Progress } from "@/components/ui/progress";
import { AiHelpButton } from "@/components/ai-help-button";
import { DailyQuests } from "@/components/daily-quests";
import { Achievements } from "@/components/achievements";
import { StudyCoach } from "@/components/study-coach";
import {
  Layers,
  Shuffle,
  ListChecks,
  Flame,
  Target,
  Sparkles,
  Megaphone,
  BookOpen,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panelim — EconKPSS" },
      { name: "description", content: "Puanların, seviyen ve günlük KPSS çalışma özetin." },
      { property: "og:title", content: "Panelim — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "KPSS ilerlemeni tek ekranda takip et." },
    ],
  }),
  component: PanelPage,
});

function PanelPage() {
  const { user } = useSession();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    data: events,
    isPending: progressLoading,
    isError: progressError,
    refetch: reloadProgress,
  } = useQuery({
    queryKey: ["my-progress", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("progress_events")
        .select("id, kind, is_correct, points, created_at, subject_id, topic, content_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const { data: subjects } = useQuery(subjectsQuery);
  const [subjectId, setSubjectId] = useState<string | null>(null);

  const { data: leaders } = useQuery({
    queryKey: ["leaderboard-mini"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", { _limit: 5 });
      if (error) throw error;
      return data ?? [];
    },
  });

  const wrongEvents = useMemo(
    () => (events ?? []).filter((e) => e.is_correct === false && e.content_id),
    [events],
  );

  const { data: mistakes } = useQuery({
    queryKey: ["my-mistakes", user?.id, wrongEvents.length],
    enabled: !!user && wrongEvents.length > 0,
    queryFn: async () => {
      const qIds = [...new Set(wrongEvents.filter((e) => e.kind === "question").map((e) => e.content_id!))];
      const cIds = [...new Set(wrongEvents.filter((e) => e.kind === "flashcard").map((e) => e.content_id!))];
      const pIds = [...new Set(wrongEvents.filter((e) => e.kind === "match").map((e) => e.content_id!))];

      const [q, c, p] = await Promise.all([
        qIds.length
          ? supabase.from("questions").select("id, prompt, options, correct_index, topic, subject_id").in("id", qIds)
          : Promise.resolve({ data: [], error: null }),
        cIds.length
          ? supabase.from("flashcards").select("id, front, back, topic, subject_id").in("id", cIds)
          : Promise.resolve({ data: [], error: null }),
        pIds.length
          ? supabase.from("match_pairs").select("id, left_text, right_text, topic, subject_id").in("id", pIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const rows: {
        id: string;
        kind: string;
        subject_id: string | null;
        topic: string | null;
        title: string;
        answer: string;
      }[] = [];
      for (const row of (q.data ?? []) as any[]) {
        rows.push({
          id: row.id,
          kind: "Soru",
          subject_id: row.subject_id,
          topic: row.topic,
          title: row.prompt,
          answer: (row.options as string[] | null)?.[row.correct_index] ?? "—",
        });
      }
      for (const row of (c.data ?? []) as any[]) {
        rows.push({ id: row.id, kind: "Kart", subject_id: row.subject_id, topic: row.topic, title: row.front, answer: row.back });
      }
      for (const row of (p.data ?? []) as any[]) {
        rows.push({ id: row.id, kind: "Eşleştirme", subject_id: row.subject_id, topic: row.topic, title: row.left_text, answer: row.right_text });
      }
      return rows;
    },
  });

  const wrongCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of wrongEvents) map.set(e.content_id!, (map.get(e.content_id!) ?? 0) + 1);
    return map;
  }, [wrongEvents]);

  const mistakeList = useMemo(() => {
    return (mistakes ?? [])
      .filter((m) => !subjectId || m.subject_id === subjectId)
      .map((m) => ({ ...m, times: wrongCounts.get(m.id) ?? 1 }))
      .sort((a, b) => b.times - a.times)
      .slice(0, 20);
  }, [mistakes, wrongCounts, subjectId]);

  const weakTopics = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of mistakeList) map.set(m.topic ?? "Genel", (map.get(m.topic ?? "Genel") ?? 0) + m.times);
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [mistakeList]);

  const { data: announcements } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const points = profile?.points ?? 0;
  const { level, inLevel, needed, progress } = levelFromPoints(points);

  const scoped = useMemo(
    () => (events ?? []).filter((e) => !subjectId || e.subject_id === subjectId),
    [events, subjectId],
  );
  const answered = scoped.filter((e) => e.is_correct !== null).length;
  const correct = scoped.filter((e) => e.is_correct === true).length;
  const wrong = answered - correct;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;
  const scopedPoints = scoped.reduce((acc, e) => acc + (e.points ?? 0), 0);

  const subjectStats = useMemo(() => {
    return (subjects ?? []).map((s) => {
      const rows = (events ?? []).filter((e) => e.subject_id === s.id);
      const a = rows.filter((e) => e.is_correct !== null).length;
      const c = rows.filter((e) => e.is_correct === true).length;
      const pts = rows.reduce((acc, e) => acc + (e.points ?? 0), 0);
      return {
        id: s.id,
        name: s.name,
        answered: a,
        correct: c,
        wrong: a - c,
        points: pts,
        accuracy: a ? Math.round((c / a) * 100) : 0,
        ...levelFromPoints(pts),
      };
    });
  }, [subjects, events]);

  const topicStats = useMemo(() => {
    const map = new Map<
      string,
      { topic: string; subject: string; answered: number; correct: number; points: number }
    >();
    for (const e of scoped) {
      const topic = e.topic ?? "Genel";
      const subject = (subjects ?? []).find((s) => s.id === e.subject_id)?.name ?? "Karışık";
      const key = `${subject}|${topic}`;
      const row = map.get(key) ?? { topic, subject, answered: 0, correct: 0, points: 0 };
      if (e.is_correct !== null) row.answered += 1;
      if (e.is_correct === true) row.correct += 1;
      row.points += e.points ?? 0;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.points - a.points).slice(0, 8);
  }, [scoped, subjects]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Merhaba{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">Bugün küçük bir adım, sınavda büyük bir fark.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="bento gradient-brand p-6 text-brand-foreground shadow-glow md:col-span-1">
          <div className="flex items-center gap-2 text-sm opacity-90">
            <Sparkles className="size-4" /> Toplam Puan
          </div>
          <p className="mt-3 font-display text-5xl font-extrabold">{points}</p>
          <p className="mt-4 text-sm opacity-90">
            Seviye {level} · {inLevel}/{needed}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="bento p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="size-4" /> Doğruluk
          </div>
          <p className="mt-3 font-display text-5xl font-extrabold">%{accuracy}</p>
          <Progress value={accuracy} className="mt-4" />
          <p className="mt-2 text-sm text-muted-foreground">
            {correct} doğru / {answered} çözüm
          </p>
        </div>

        <div className="bento p-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flame className="size-4" /> Toplam Aktivite
          </div>
          <p className="mt-3 font-display text-5xl font-extrabold">{events?.length ?? 0}</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Kart, eşleştirme ve soru çözümlerin
          </p>
        </div>
      </div>

      {user && <DailyQuests userId={user.id} events={events ?? []} />}

      <StudyCoach
        events={events}
        subjects={subjects ?? []}
        isLoading={progressLoading}
        isError={progressError}
        onRetry={() => void reloadProgress()}
      />

      <Achievements
        events={events ?? []}
        points={profile?.points ?? 0}
        streak={profile?.streak ?? 0}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <QuickCard
          to="/kartlar"
          icon={<Layers className="size-5" />}
          title="Bilgi Kartları"
          text="Arkalı önlü kartlarla hızlı tekrar yap."
          tone="gradient-mint"
        />
        <QuickCard
          to="/eslestirme"
          icon={<Shuffle className="size-5" />}
          title="Eşleştirme Oyunu"
          text="Sürükle bırak ile kavramları eşleştir."
          tone="gradient-warm"
        />
        <QuickCard
          to="/sorular"
          icon={<ListChecks className="size-5" />}
          title="Soru Bankası"
          text="Puan kazan, seviye atla."
          tone="gradient-brand"
        />
      </div>

      <section className="bento p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="size-4 text-primary" /> Ders Seçimi ve İlerleme
          </h2>
          <span className="text-sm text-muted-foreground">
            {subjectId ? `${scopedPoints} puan bu dersten` : `${scopedPoints} toplam kazanılan puan`}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubjectId(null)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              subjectId === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Tüm Dersler
          </button>
          {(subjects ?? []).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectId(s.id)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                subjectId === s.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-secondary p-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-primary" /> Doğru
            </span>
            <p className="mt-1 font-display text-2xl font-extrabold">{correct}</p>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="size-4 text-destructive" /> Yanlış
            </span>
            <p className="mt-1 font-display text-2xl font-extrabold">{wrong}</p>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="size-4 text-primary" /> Başarı
            </span>
            <p className="mt-1 font-display text-2xl font-extrabold">%{accuracy}</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {subjectStats
            .filter((s) => !subjectId || s.id === subjectId)
            .map((s) => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    {s.name}{" "}
                    <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      Seviye {s.level}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    {s.correct} doğru · {s.wrong} yanlış · %{s.accuracy}
                  </span>
                </div>
                <Progress value={s.progress} className="mt-2" />
                <p className="mt-1 text-xs text-muted-foreground">
                  {s.inLevel}/{s.needed} puan · sonraki seviyeye {s.needed - s.inLevel} puan
                </p>
              </div>
            ))}
          {!subjectStats.length && (
            <p className="text-sm text-muted-foreground">Henüz ders bulunmuyor.</p>
          )}
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Konu Bazlı Seviye
          </h3>
          <ul className="mt-3 space-y-3">
            {topicStats.map((t) => {
              const lvl = levelFromPoints(t.points);
              const acc = t.answered ? Math.round((t.correct / t.answered) * 100) : 0;
              return (
                <li key={`${t.subject}-${t.topic}`}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {t.topic}{" "}
                      <span className="text-xs text-muted-foreground">· {t.subject}</span>
                    </span>
                    <span className="text-muted-foreground">
                      Seviye {lvl.level} · {t.correct}/{t.answered} · %{acc}
                    </span>
                  </div>
                  <Progress value={lvl.progress} className="mt-2" />
                </li>
              );
            })}
            {!topicStats.length && (
              <li className="text-sm text-muted-foreground">
                Bu derste henüz çalışma yok. Bilgi kartları veya sorularla başla!
              </li>
            )}
          </ul>
        </div>
      </section>

      <div className="bento p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Yanlışlarım</h2>
          <span className="text-sm text-muted-foreground">
            En çok zorlandığın {mistakeList.length} içerik
          </span>
        </div>

        {weakTopics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {weakTopics.map(([topic, times]) => (
              <span
                key={topic}
                className="rounded-full bg-destructive/10 px-3 py-1 text-xs font-semibold text-destructive"
              >
                {topic} · {times} yanlış
              </span>
            ))}
          </div>
        )}

        <ul className="mt-4 space-y-2">
          {mistakeList.map((m) => (
            <li key={`${m.kind}-${m.id}`} className="rounded-xl bg-secondary px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{m.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Doğrusu: {m.answer}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-bold">
                    {m.kind} · {m.times}x
                  </span>
                  <AiHelpButton prompt={m.title} correct={m.answer} topic={m.topic} />
                </span>
              </div>
            </li>
          ))}
          {!mistakeList.length && (
            <li className="text-sm text-muted-foreground">
              Harika! Şu an listelenecek yanlışın yok. 🎉
            </li>
          )}
        </ul>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">

        <div className="bento p-6 lg:col-span-3">
          <h2 className="text-lg font-bold">Liderlik Tablosu</h2>
          <ul className="mt-4 space-y-2">
            {(leaders ?? []).map((l, i) => (
              <li
                key={l.id}
                className={`flex items-center justify-between rounded-xl px-3 py-2.5 ${
                  l.id === user?.id ? "bg-primary/10" : "bg-secondary"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full bg-background text-xs font-bold">
                    {i + 1}
                  </span>
                  <span className="font-medium">{l.full_name ?? "Öğrenci"}</span>
                </span>
                <span className="font-display font-bold">{l.points}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/liderlik"
            className="mt-4 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Tüm sıralamayı gör
          </Link>
        </div>

        <div className="bento p-6 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Megaphone className="size-4 text-primary" /> Duyurular
          </h2>
          <ul className="mt-4 space-y-4">
            {(announcements ?? []).filter((a) => !a.title.includes("Yönetici onayı bekleyen")).map((a) => (
              <li key={a.id} className="border-l-2 border-primary/40 pl-3">
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.body}</p>
              </li>
            ))}
            {!(announcements ?? []).some((a) => !a.title.includes("Yönetici onayı bekleyen")) && (
              <li className="text-sm text-muted-foreground">Henüz duyuru yok.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function QuickCard({
  to,
  icon,
  title,
  text,
  tone,
}: {
  to: "/kartlar" | "/eslestirme" | "/sorular";
  icon: React.ReactNode;
  title: string;
  text: string;
  tone: string;
}) {
  return (
    <Link to={to} className="bento group p-6 transition-shadow hover:shadow-lift">
      <span
        className={`${tone} flex size-11 items-center justify-center rounded-xl text-brand-foreground`}
      >
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </Link>
  );
}
