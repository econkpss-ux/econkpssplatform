import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { subjectsQuery, awardPoints, shuffleArray } from "@/lib/econ";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report-button";
import { AiHelpButton } from "@/components/ai-help-button";
import { ComboMeter } from "@/components/combo-meter";
import { RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { burstConfetti, feedbackMessage, streakMessage } from "@/lib/celebrate";
import { useResumableState } from "@/lib/use-resumable-state";

export const Route = createFileRoute("/_authenticated/eslestirme")({
  head: () => ({
    meta: [
      { title: "Eşleştirme Oyunu — EconKPSS" },
      {
        name: "description",
        content: "Sürükle bırak eşleştirme egzersizleriyle Tarih, Coğrafya ve Vatandaşlık öğren.",
      },
      { property: "og:title", content: "Eşleştirme Oyunu — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Kavramları eşleştir, akılda kalıcılığı artır." },
    ],
  }),
  component: MatchPage,
});

type Pair = {
  id: string;
  left_text: string;
  right_text: string;
  subject_id: string;
  topic: string | null;
};

const shuffle = shuffleArray;

type MatchSession = {
  subjectId: string | null;
  gameIds: string[];
  answerIds: string[];
  round: number;
  matched: Record<string, string>;
  wrongId: string | null;
  selected: string | null;
  streak: number;
  lastWrongId: string | null;
};

const INITIAL_MATCH_SESSION: MatchSession = {
  subjectId: null,
  gameIds: [],
  answerIds: [],
  round: 0,
  matched: {},
  wrongId: null,
  selected: null,
  streak: 0,
  lastWrongId: null,
};

function isMatchSession(value: unknown): value is MatchSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    (session.subjectId === null || typeof session.subjectId === "string") &&
    Array.isArray(session.gameIds) &&
    session.gameIds.every((id) => typeof id === "string") &&
    Array.isArray(session.answerIds) &&
    session.answerIds.every((id) => typeof id === "string") &&
    Number.isInteger(session.round) &&
    !!session.matched &&
    typeof session.matched === "object" &&
    Object.values(session.matched).every((id) => typeof id === "string") &&
    (session.wrongId === null || typeof session.wrongId === "string") &&
    (session.selected === null || typeof session.selected === "string") &&
    Number.isInteger(session.streak) &&
    (session.lastWrongId === null || typeof session.lastWrongId === "string")
  );
}

function MatchPage() {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects } = useQuery(subjectsQuery);
  const [session, setSession, sessionReady] = useResumableState(
    "matching",
    user?.id ?? (loading ? null : "guest"),
    INITIAL_MATCH_SESSION,
    isMatchSession,
  );
  const { subjectId, matched, wrongId, selected, streak } = session;

  const { data: pairs } = useQuery({
    queryKey: ["match-pairs", subjectId],
    queryFn: async () => {
      let q = supabase.from("match_pairs").select("*");
      if (subjectId) q = q.eq("subject_id", subjectId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Pair[];
    },
  });

  const game = useMemo(() => {
    if (!pairs) return [];
    if (!session.gameIds.length) return shuffle(pairs).slice(0, 5);
    const byId = new Map(pairs.map((item) => [item.id, item]));
    const restored = session.gameIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    return restored.length ? restored : shuffle(pairs).slice(0, 5);
  }, [pairs, session.gameIds]);
  const gameIds = useMemo(() => game.map((item) => item.id), [game]);
  const gameIdsKey = gameIds.join("|");
  useEffect(() => {
    if (!pairs || !game.length) return;
    if (gameIdsKey !== session.gameIds.join("|")) {
      setSession((current) => ({
        ...current,
        gameIds,
        answerIds: [],
        matched: {},
        wrongId: null,
        selected: null,
        lastWrongId: null,
      }));
    }
  }, [game.length, gameIds, gameIdsKey, pairs, session.gameIds, setSession]);

  const answers = useMemo(() => {
    if (!session.answerIds.length) return shuffle(game);
    const byId = new Map(game.map((item) => [item.id, item]));
    const restored = session.answerIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    return restored.length === game.length ? restored : shuffle(game);
  }, [game, session.answerIds]);
  const answerIds = useMemo(() => answers.map((item) => item.id), [answers]);
  const answerIdsKey = answerIds.join("|");
  useEffect(() => {
    if (!game.length || session.answerIds.length) return;
    setSession((current) => ({ ...current, answerIds }));
  }, [answerIds, answerIdsKey, game.length, session.answerIds.length, setSession]);

  const lastWrong = game.find((pair) => pair.id === session.lastWrongId) ?? null;

  const done = game.length > 0 && Object.keys(matched).length === game.length;

  async function tryMatch(pairId: string, answerId: string) {
    if (pairId === answerId) {
      const nextStreak = streak + 1;
      setSession((current) => ({
        ...current,
        streak: nextStreak,
        lastWrongId: null,
        matched: { ...current.matched, [pairId]: answerId },
      }));
      if (Object.keys(matched).length + 1 === game.length) burstConfetti(36);
      if (nextStreak >= 3) burstConfetti(18);
      toast.success(streakMessage(nextStreak) ?? feedbackMessage(true));
      if (user) {
        await awardPoints({
          userId: user.id,
          subjectId: game.find((g) => g.id === pairId)?.subject_id ?? null,
          topic: game.find((g) => g.id === pairId)?.topic ?? null,
          kind: "match",
          isCorrect: true,
          points: 6,
        });
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        queryClient.invalidateQueries({ queryKey: ["my-progress", user.id] });
      }
    } else {
      setSession((current) => ({
        ...current,
        wrongId: pairId,
        streak: 0,
        lastWrongId: pairId,
      }));
      toast(feedbackMessage(false));
      setTimeout(() => {
        setSession((current) =>
          current.wrongId === pairId ? { ...current, wrongId: null } : current,
        );
      }, 500);
      // Yanlış eşleştirmeler de kaydedilsin ki "Yanlışlarım" listesinde görünsün.
      if (user) {
        const pair = game.find((g) => g.id === pairId);
        await awardPoints({
          userId: user.id,
          subjectId: pair?.subject_id ?? null,
          topic: pair?.topic ?? null,
          kind: "match",
          isCorrect: false,
          points: 0,
          contentId: pairId,
        });
        queryClient.invalidateQueries({ queryKey: ["my-progress", user.id] });
        queryClient.invalidateQueries({ queryKey: ["my-mistakes", user.id] });
      }
    }
    setSession((current) => ({ ...current, selected: null }));
  }

  function nextRound() {
    setSession((current) => ({
      ...INITIAL_MATCH_SESSION,
      subjectId: current.subjectId,
      round: current.round + 1,
    }));
  }

  function resetSubject(id: string | null) {
    setSession((current) => ({
      ...INITIAL_MATCH_SESSION,
      subjectId: id,
      round: current.round + 1,
    }));
  }

  if (loading || !sessionReady) {
    return (
      <p className="bento p-6 text-center text-muted-foreground">Çalışma oturumu yükleniyor…</p>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Eşleştirme Oyunu</h1>
          <p className="mt-1 text-muted-foreground">
            Sağdaki cevabı sürükleyip soldaki kavrama bırak — ya da dokunarak eşleştir.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ComboMeter streak={streak} />
          <Button variant="outline" onClick={nextRound}>
            <RefreshCw className="size-4" /> Yeni tur
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Chip active={subjectId === null} onClick={() => resetSubject(null)}>
          Tümü
        </Chip>
        {(subjects ?? []).map((s) => (
          <Chip key={s.id} active={subjectId === s.id} onClick={() => resetSubject(s.id)}>
            {s.name}
          </Chip>
        ))}
      </div>

      {done && (
        <div className="bento gradient-mint flex items-center gap-3 p-5 text-brand-foreground">
          <Sparkles className="size-5" />
          <p className="font-semibold">Harika! Tüm eşleşmeleri tamamladın.</p>
          <Button variant="secondary" size="sm" onClick={nextRound}>
            Devam et
          </Button>
        </div>
      )}

      {lastWrong && (
        <div className="bento flex flex-wrap items-center justify-between gap-3 border-destructive/30 p-4">
          <p className="text-sm">
            <span className="font-semibold">{lastWrong.left_text}</span> eşleşmesini kaçırdın.
          </p>
          <div className="flex items-center gap-2">
            <AiHelpButton
              prompt={`Hangi kavram "${lastWrong.left_text}" ile eşleşir?`}
              correct={lastWrong.right_text}
              topic={lastWrong.topic}
            />
            <ReportButton
              contentType="match_pair"
              contentId={lastWrong.id}
              preview={`${lastWrong.left_text} → ${lastWrong.right_text}`}
            />
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Kavramlar
          </h2>
          {game.map((p) => (
            <div
              key={p.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                tryMatch(p.id, e.dataTransfer.getData("text/plain"));
              }}
              onClick={() => selected && tryMatch(p.id, selected)}
              className={`rounded-xl border p-4 transition-colors ${
                matched[p.id]
                  ? "border-mint bg-mint/15"
                  : wrongId === p.id
                    ? "border-destructive bg-destructive/10"
                    : "border-dashed border-border bg-card"
              }`}
            >
              <p className="font-semibold">{p.left_text}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {matched[p.id] ? p.right_text : "Buraya bırak"}
              </p>
              {matched[p.id] && (
                <ReportButton
                  contentType="match_pair"
                  contentId={p.id}
                  preview={`${p.left_text} → ${p.right_text}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Cevaplar
          </h2>
          {answers.map((p) => {
            const used = Boolean(matched[p.id]);
            return (
              <button
                key={p.id}
                type="button"
                draggable={!used}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                onClick={() => setSession((current) => ({ ...current, selected: p.id }))}
                disabled={used}
                className={`w-full cursor-grab rounded-xl border px-4 py-3 text-left font-medium transition-colors ${
                  used
                    ? "cursor-default border-border bg-secondary text-muted-foreground opacity-50"
                    : selected === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                }`}
              >
                {p.right_text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
