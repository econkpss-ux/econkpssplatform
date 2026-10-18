import { useMemo } from "react";
import { Medal, Lock } from "lucide-react";

type Ev = { kind: string; is_correct: boolean | null; points: number | null; created_at: string };

type Badge = { id: string; emoji: string; label: string; desc: string; earned: boolean };

/** Kazanılan ve kilitli rozetleri gösteren koleksiyon bölümü. */
export function Achievements({ events, points, streak }: { events: Ev[]; points: number; streak: number }) {
  const badges = useMemo<Badge[]>(() => {
    const questions = events.filter((e) => e.kind === "question");
    const correct = questions.filter((e) => e.is_correct).length;
    const matches = events.filter((e) => e.kind === "match").length;
    const cards = events.filter((e) => e.kind === "flashcard").length;
    const accuracy = questions.length >= 20 ? correct / questions.length : 0;
    const championships = events.filter((e) => e.kind === "quest:all").length;
    return [
      { id: "first", emoji: "🌱", label: "İlk Adım", desc: "İlk aktiviteni tamamla", earned: events.length > 0 },
      { id: "q100", emoji: "📚", label: "Soru Avcısı", desc: "100 soru çöz", earned: questions.length >= 100 },
      { id: "q500", emoji: "🎓", label: "Soru Ustası", desc: "500 soru çöz", earned: questions.length >= 500 },
      { id: "acc90", emoji: "🎯", label: "Keskin Nişancı", desc: "20+ soruda %90 doğruluk", earned: accuracy >= 0.9 },
      { id: "m50", emoji: "🧩", label: "Eşleştirme Kralı", desc: "50 eşleştirme yap", earned: matches >= 50 },
      { id: "f50", emoji: "🃏", label: "Kart Kurdu", desc: "50 kart çevir", earned: cards >= 50 },
      { id: "s3", emoji: "🔥", label: "Ateşli Seri", desc: "3 günlük seri", earned: streak >= 3 },
      { id: "s7", emoji: "⚡", label: "Haftalık Seri", desc: "7 günlük seri", earned: streak >= 7 },
      { id: "s30", emoji: "👑", label: "Efsane Seri", desc: "30 günlük seri", earned: streak >= 30 },
      { id: "p1000", emoji: "💰", label: "Binlik", desc: "1.000 puan topla", earned: points >= 1000 },
      { id: "p10000", emoji: "💎", label: "On Binlik", desc: "10.000 puan topla", earned: points >= 10000 },
      { id: "champ", emoji: "🏆", label: "Şampiyon", desc: "Bir günün tüm görevlerini bitir", earned: championships > 0 },
    ];
  }, [events, points, streak]);

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <div className="bento p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Medal className="size-4 text-primary" /> Başarımlar
        </h2>
        <span className="text-xs font-semibold text-muted-foreground">
          {earnedCount}/{badges.length} rozet
        </span>
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {badges.map((b) => (
          <li
            key={b.id}
            title={b.desc}
            className={`rounded-xl p-3 text-center transition-transform ${
              b.earned
                ? "bg-amber/15 ring-1 ring-amber/40 hover:scale-[1.03]"
                : "bg-secondary/60 opacity-60 grayscale"
            }`}
          >
            <span className="text-2xl">{b.earned ? b.emoji : <Lock className="mx-auto size-5 text-muted-foreground" />}</span>
            <p className="mt-1 text-xs font-bold">{b.label}</p>
            <p className="text-[11px] text-muted-foreground">{b.desc}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
