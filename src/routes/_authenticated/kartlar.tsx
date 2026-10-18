import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { subjectsQuery, awardPoints, shuffleArray } from "@/lib/econ";
import { Button } from "@/components/ui/button";
import { ReportButton } from "@/components/report-button";
import { ComboMeter } from "@/components/combo-meter";
import { Check, RotateCcw, X, ArrowRight, Shuffle } from "lucide-react";
import { burstConfetti, feedbackMessage, streakMessage } from "@/lib/celebrate";
import { useResumableState } from "@/lib/use-resumable-state";

export const Route = createFileRoute("/_authenticated/kartlar")({
  head: () => ({
    meta: [
      { title: "Akıllı Bilgi Kartları — EconKPSS" },
      {
        name: "description",
        content: "Arkalı önlü dijital hafıza kartlarıyla KPSS konularını hızlıca tekrar et.",
      },
      { property: "og:title", content: "Akıllı Bilgi Kartları — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Cevaplarına göre şekillenen akıllı tekrar sistemi." },
    ],
  }),
  component: FlashcardsPage,
});

type FlashcardSession = {
  subjectId: string | null;
  cardIds: string[];
  index: number;
  flipped: boolean;
  known: number;
  streak: number;
  round: number;
};

const INITIAL_FLASHCARD_SESSION: FlashcardSession = {
  subjectId: null,
  cardIds: [],
  index: 0,
  flipped: false,
  known: 0,
  streak: 0,
  round: 0,
};

function isFlashcardSession(value: unknown): value is FlashcardSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    (session.subjectId === null || typeof session.subjectId === "string") &&
    Array.isArray(session.cardIds) &&
    session.cardIds.every((id) => typeof id === "string") &&
    Number.isInteger(session.index) &&
    typeof session.flipped === "boolean" &&
    Number.isInteger(session.known) &&
    Number.isInteger(session.streak) &&
    Number.isInteger(session.round)
  );
}

function FlashcardsPage() {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  const { data: subjects } = useQuery(subjectsQuery);
  const [session, setSession, sessionReady] = useResumableState(
    "flashcards",
    user?.id ?? (loading ? null : "guest"),
    INITIAL_FLASHCARD_SESSION,
    isFlashcardSession,
  );
  const { subjectId, index, flipped, known, streak } = session;

  const { data: cards } = useQuery({
    queryKey: ["flashcards", subjectId],
    queryFn: async () => {
      let q = supabase.from("flashcards").select("*");
      if (subjectId) q = q.eq("subject_id", subjectId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const deck = useMemo(() => {
    if (!cards) return [];
    if (!session.cardIds.length) return shuffleArray(cards);
    const byId = new Map(cards.map((item) => [item.id, item]));
    const restored = session.cardIds.flatMap((id) => {
      const item = byId.get(id);
      return item ? [item] : [];
    });
    return restored.length ? restored : shuffleArray(cards);
  }, [cards, session.cardIds]);
  const deckIds = useMemo(() => deck.map((item) => item.id), [deck]);
  const deckIdsKey = deckIds.join("|");
  useEffect(() => {
    if (!cards || !deck.length) return;
    if (deckIdsKey !== session.cardIds.join("|")) {
      setSession((current) => ({
        ...current,
        cardIds: deckIds,
        index: Math.min(current.index, deck.length - 1),
        flipped: false,
      }));
    }
  }, [cards, deck.length, deckIds, deckIdsKey, session.cardIds, setSession]);
  const card = deck[index];
  const [saving, setSaving] = useState(false);

  async function answer(correct: boolean) {
    if (!user || !card || saving) return;
    const nextStreak = correct ? streak + 1 : 0;
    setSaving(true);
    try {
      await awardPoints({
        userId: user.id,
        subjectId: card.subject_id,
        topic: card.topic ?? null,
        kind: "flashcard",
        isCorrect: correct,
        points: correct ? 5 : 1,
        contentId: card.id,
      });
    } catch (error) {
      console.error("Unable to save flashcard answer.", error);
      toast.error("Cevabın kaydedilemedi. Bağlantını kontrol edip tekrar dene.");
      return;
    } finally {
      setSaving(false);
    }
    setSession((current) => ({
      ...current,
      streak: nextStreak,
      known: correct ? current.known + 1 : current.known,
      flipped: false,
      index: (current.index + 1) % Math.max(deck.length, 1),
    }));
    if (correct) {
      burstConfetti(nextStreak >= 3 ? 26 : 14);
      toast.success(streakMessage(nextStreak) ?? feedbackMessage(true));
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
          <h1 className="text-3xl font-bold">Akıllı Bilgi Kartları</h1>
          <p className="mt-1 text-muted-foreground">
            Kartı çevir, bildiklerini işaretle; puanın anında artsın.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ComboMeter streak={streak} />
          <Button variant="outline" size="sm" onClick={() => resetTo(subjectId)}>
            <Shuffle className="size-4" /> Karıştır
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <Chip active={subjectId === null} onClick={() => resetTo(null)}>
          Tümü
        </Chip>
        {(subjects ?? []).map((s) => (
          <Chip key={s.id} active={subjectId === s.id} onClick={() => resetTo(s.id)}>
            {s.name}
          </Chip>
        ))}
      </div>

      {card ? (
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => setSession((current) => ({ ...current, flipped: !current.flipped }))}
            className="bento flex min-h-64 w-full flex-col items-center justify-center gap-3 p-10 text-center transition-shadow hover:shadow-lift"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {flipped ? "Cevap" : "Soru"}
            </span>
            <span className="font-display text-2xl font-bold">
              {flipped ? card.back : card.front}
            </span>
            <span className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <RotateCcw className="size-3" /> Çevirmek için tıkla
            </span>
          </button>

          <div className="mt-5 flex items-center justify-between gap-3">
            <Button variant="outline" disabled={saving} onClick={() => answer(false)}>
              <X className="size-4" /> Tekrar et
            </Button>
            <span className="text-sm text-muted-foreground">
              {index + 1} / {deck.length} · {known} bildim
            </span>
            <Button disabled={saving} onClick={() => answer(true)}>
              <Check className="size-4" /> Biliyorum
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setSession((current) => ({
                  ...current,
                  flipped: false,
                  index: (current.index + 1) % deck.length,
                }));
              }}
            >
              Atla <ArrowRight className="size-4" />
            </Button>
            <ReportButton
              contentType="flashcard"
              contentId={card.id}
              preview={`${card.front} → ${card.back}`}
            />
          </div>
        </div>
      ) : (
        <p className="bento p-10 text-center text-muted-foreground">Bu derste henüz kart yok.</p>
      )}
    </div>
  );

  function resetTo(id: string | null) {
    setSession((current) => ({
      ...INITIAL_FLASHCARD_SESSION,
      subjectId: id,
      round: current.round + 1,
    }));
  }
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
