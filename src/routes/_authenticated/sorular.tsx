import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { subjectsQuery, awardPoints, shuffleArray } from "@/lib/econ";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report-button";
import { AiHelpButton } from "@/components/ai-help-button";
import { ComboMeter } from "@/components/combo-meter";
import { toast } from "sonner";
import { burstConfetti, feedbackMessage, streakMessage } from "@/lib/celebrate";
import { CheckCircle2, XCircle, Trophy, Shuffle } from "lucide-react";
import { useResumableState } from "@/lib/use-resumable-state";

export const Route = createFileRoute("/_authenticated/sorular")({
  validateSearch: (search: Record<string, unknown>) => ({
    subjectId:
      typeof search["subjectId"] === "string" && search["subjectId"].length <= 64
        ? search["subjectId"]
        : undefined,
    topic:
      typeof search["topic"] === "string" && search["topic"].length <= 160
        ? search["topic"]
        : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Oyunlaştırılmış Soru Bankası — EconKPSS" },
      {
        name: "description",
        content: "Soru çöz, doğru cevaplarla puan kazan ve seviye atla.",
      },
      { property: "og:title", content: "Oyunlaştırılmış Soru Bankası — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Her doğru cevap seni bir adım yukarı taşır." },
    ],
  }),
  component: QuestionsPage,
});

type QuestionSession = {
  subjectId: string | null;
  topic?: string | null;
  questionIds: string[];
  optionOrders: Record<string, number[]>;
  index: number;
  picked: number | null;
  score: number;
  streak: number;
  round: number;
};

const INITIAL_QUESTION_SESSION: QuestionSession = {
  subjectId: null,
  topic: null,
  questionIds: [],
  optionOrders: {},
  index: 0,
  picked: null,
  score: 0,
  streak: 0,
  round: 0,
};

function isQuestionSession(value: unknown): value is QuestionSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    (session["subjectId"] === null || typeof session["subjectId"] === "string") &&
    (session["topic"] === undefined ||
      session["topic"] === null ||
      typeof session["topic"] === "string") &&
    Array.isArray(session["questionIds"]) &&
    session["questionIds"].every((id) => typeof id === "string") &&
    !!session["optionOrders"] &&
    typeof session["optionOrders"] === "object" &&
    Object.values(session["optionOrders"]).every(
      (order) => Array.isArray(order) && order.every(Number.isInteger),
    ) &&
    Number.isInteger(session["index"]) &&
    Number.isInteger(session["score"]) &&
    Number.isInteger(session["streak"]) &&
    Number.isInteger(session["round"]) &&
    (session["picked"] === null || Number.isInteger(session["picked"]))
  );
}

function QuestionsPage() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const queryClient = useQueryClient();
  const { data: subjects } = useQuery(subjectsQuery);
  const appliedFocus = useRef<string | null>(null);
  const [session, setSession, sessionReady] = useResumableState(
    "questions",
    user?.id ?? (loading ? null : "guest"),
    INITIAL_QUESTION_SESSION,
    isQuestionSession,
  );
  const { subjectId, index, picked, score, streak } = session;
  const focusKey =
    search.subjectId || search.topic ? `${search.subjectId ?? ""}|${search.topic ?? ""}` : null;

  useEffect(() => {
    if (!sessionReady) return;
    if (!focusKey) {
      appliedFocus.current = null;
      return;
    }
    if (appliedFocus.current === focusKey) return;
    appliedFocus.current = focusKey;
    setSession((current) => ({
      ...INITIAL_QUESTION_SESSION,
      subjectId: search.subjectId ?? null,
      topic: search.topic ?? null,
      round: current.round + 1,
    }));
  }, [focusKey, search.subjectId, search.topic, sessionReady, setSession]);

  const { data: questions } = useQuery({
    queryKey: ["questions", subjectId, session.topic],
    queryFn: async () => {
      let q = supabase.from("questions").select("*");
      if (subjectId) q = q.eq("subject_id", subjectId);
      if (session.topic) q = q.eq("topic", session.topic);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const list = useMemo(() => {
    if (!questions) return [];
    if (!session.questionIds.length) return shuffleArray(questions);
    const byId = new Map(questions.map((item) => [item.id, item]));
    const restored = session.questionIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    return restored.length ? restored : shuffleArray(questions);
  }, [questions, session.questionIds]);
  const listIds = useMemo(() => list.map((item) => item.id), [list]);
  const listIdsKey = listIds.join("|");
  useEffect(() => {
    if (!questions || !list.length) return;
    if (listIdsKey !== session.questionIds.join("|")) {
      setSession((current) => ({
        ...current,
        questionIds: listIds,
        optionOrders: {},
        index: Math.min(current.index, list.length - 1),
        picked: null,
      }));
    }
  }, [list.length, listIds, listIdsKey, questions, session.questionIds, setSession]);
  const question = list[index];
  const options = useMemo(() => {
    const raw = (question?.options as string[] | null) ?? [];
    const savedOrder = question ? session.optionOrders[question.id] : undefined;
    const validOrder =
      savedOrder?.length === raw.length &&
      new Set(savedOrder).size === raw.length &&
      savedOrder.every((index) => Number.isInteger(index) && index >= 0 && index < raw.length);
    const order = validOrder ? savedOrder : shuffleArray(raw.map((_, index) => index));
    return order.map((original) => ({ text: raw[original]!, original }));
  }, [question, session.optionOrders]);
  useEffect(() => {
    if (!question || question.id in session.optionOrders) return;
    setSession((current) => ({
      ...current,
      optionOrders: {
        ...current.optionOrders,
        [question.id]: options.map((option) => option.original),
      },
    }));
  }, [options, question, session.optionOrders, setSession]);

  async function pick(originalIndex: number) {
    if (picked !== null || !question || !user) return;
    const correct = originalIndex === question.correct_index;
    const nextStreak = correct ? streak + 1 : 0;
    try {
      await awardPoints({
        userId: user.id,
        subjectId: question.subject_id,
        topic: question.topic ?? null,
        kind: "question",
        isCorrect: correct,
        points: correct ? 10 + Math.min(nextStreak, 5) * 2 : 0,
        contentId: question.id,
      });
    } catch (error) {
      console.error("Unable to save question answer.", error);
      toast.error("Cevabın kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
      return;
    }
    setSession((current) => ({
      ...current,
      picked: originalIndex,
      streak: nextStreak,
      score: correct ? current.score + 1 : current.score,
    }));
    if (correct) {
      burstConfetti(nextStreak >= 3 ? 30 : 16);
      const combo = streakMessage(nextStreak);
      toast.success(combo ?? feedbackMessage(true));
    } else {
      toast(feedbackMessage(false));
    }
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    queryClient.invalidateQueries({ queryKey: ["my-progress", user.id] });
    queryClient.invalidateQueries({ queryKey: ["my-mistakes", user.id] });
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
          <h1 className="text-3xl font-bold">Soru Bankası</h1>
          <p className="mt-1 text-muted-foreground">
            Üst üste doğru yaptıkça bonus puan kazanırsın.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => reset(subjectId)}>
            <Shuffle className="size-4" /> Karıştır
          </Button>
          <div className="bento flex items-center gap-4 px-4 py-2 text-sm">
            <span className="flex items-center gap-1 font-semibold">
              <Trophy className="size-4 text-primary" /> {score} doğru
            </span>
            <ComboMeter streak={streak} />
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={subjectId === null} onClick={() => reset(null)}>
          Tümü
        </FilterChip>
        {(subjects ?? []).map((s) => (
          <FilterChip key={s.id} active={subjectId === s.id} onClick={() => reset(s.id)}>
            {s.name}
          </FilterChip>
        ))}
      </div>

      {session.topic && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            <span className="font-semibold">Konu odağı:</span> {session.topic}
          </p>
          <Button variant="ghost" size="sm" onClick={() => reset(subjectId)}>
            Tüm konular
          </Button>
        </div>
      )}

      {question ? (
        <div className="bento mx-auto max-w-3xl p-7">
          <p className="text-sm text-muted-foreground">
            Soru {index + 1} / {list.length}
          </p>
          <h2 className="mt-2 text-xl font-bold">{question.prompt}</h2>

          <ul className="mt-6 space-y-3">
            {options.map((opt) => {
              const i = opt.original;
              const isCorrect = i === question.correct_index;
              const state =
                picked === null ? "idle" : isCorrect ? "correct" : picked === i ? "wrong" : "idle";
              return (
                <li key={`${question.id}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    disabled={picked !== null}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                      state === "correct"
                        ? "border-mint bg-mint/15"
                        : state === "wrong"
                          ? "border-destructive bg-destructive/10"
                          : "border-border hover:border-primary/50 hover:bg-accent"
                    }`}
                  >
                    <span>{opt.text}</span>
                    {state === "correct" && <CheckCircle2 className="size-5 text-mint" />}
                    {state === "wrong" && <XCircle className="size-5 text-destructive" />}
                  </button>
                </li>
              );
            })}
          </ul>

          {picked !== null && (
            <div className="mt-6 rounded-xl bg-secondary p-4">
              <p className="text-sm">
                <span className="font-semibold">Açıklama: </span>
                {question.explanation ?? "—"}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <Button
                  onClick={() => {
                    setSession((current) => ({
                      ...current,
                      picked: null,
                      index: (current.index + 1) % list.length,
                    }));
                  }}
                >
                  Sonraki soru
                </Button>
                <div className="flex items-center gap-2">
                  {picked !== question.correct_index && (
                    <AiHelpButton
                      prompt={question.prompt}
                      correct={(question.options as string[])[question.correct_index] ?? ""}
                      picked={(question.options as string[])[picked] ?? undefined}
                      topic={question.topic}
                    />
                  )}
                  <ReportButton
                    contentType="question"
                    contentId={question.id}
                    preview={question.prompt}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="bento p-10 text-center text-muted-foreground">Bu derste henüz soru yok.</p>
      )}
    </div>
  );

  function reset(id: string | null) {
    setSession((current) => ({
      ...INITIAL_QUESTION_SESSION,
      subjectId: id,
      round: current.round + 1,
    }));
    if (focusKey) {
      void navigate({ to: "/sorular", search: { subjectId: undefined, topic: undefined } });
    }
  }
}

function FilterChip({
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
