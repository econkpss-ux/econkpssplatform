import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { burstConfetti } from "@/lib/celebrate";
import { Award, CheckCircle2, Gift, Swords } from "lucide-react";

type Ev = { kind: string; is_correct: boolean | null; created_at: string };

const QUESTS = [
  { id: "q10", label: "10 soru çöz", target: 10, points: 30, count: (e: Ev[]) => e.filter((x) => x.kind === "question").length },
  { id: "c5", label: "5 doğru cevap ver", target: 5, points: 20, count: (e: Ev[]) => e.filter((x) => x.kind === "question" && x.is_correct).length },
  { id: "m10", label: "10 eşleştirme yap", target: 10, points: 20, count: (e: Ev[]) => e.filter((x) => x.kind === "match").length },
  { id: "f10", label: "10 bilgi kartı çevir", target: 10, points: 20, count: (e: Ev[]) => e.filter((x) => x.kind === "flashcard").length },
] as const;

const BONUS = 50;

export function DailyQuests({ userId, events }: { userId: string; events: Ev[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const today = new Date().toDateString();
  const todays = events.filter((e) => new Date(e.created_at).toDateString() === today);
  const claimed = new Set(todays.filter((e) => e.kind.startsWith("quest:")).map((e) => e.kind.slice(6)));
  const badges = new Set(events.filter((e) => e.kind === "quest:all").map((e) => new Date(e.created_at).toDateString())).size;
  const allDone = QUESTS.every((q) => claimed.has(q.id));

  async function claim(id: string, points: number) {
    setBusy(id);
    const { error } = await supabase.from("progress_events").insert({ user_id: userId, kind: `quest:${id}`, points });
    setBusy(null);
    if (error) { toast.error("Ödül alınamadı, tekrar dene."); return; }
    burstConfetti(30);
    toast.success(id === "all" ? `🏆 Günün Şampiyonu rozeti! +${points} puan` : `Görev tamam! +${points} puan`);
    qc.invalidateQueries({ queryKey: ["my-progress"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  const chestOpened = todays.some((e) => e.kind === "chest");
  async function openChest() {
    const roll = Math.random();
    const points = roll > 0.95 ? 100 : roll > 0.75 ? 40 : roll > 0.4 ? 20 : 10;
    setBusy("chest");
    const { error } = await supabase.from("progress_events").insert({ user_id: userId, kind: "chest", points });
    setBusy(null);
    if (error) { toast.error("Sandık açılamadı, tekrar dene."); return; }
    burstConfetti(points >= 40 ? 60 : 25);
    toast.success(points === 100 ? "💎 EFSANE SANDIK! +100 puan" : points === 40 ? `✨ Nadir sandık! +${points} puan` : `🎁 Şans sandığı: +${points} puan`);
    qc.invalidateQueries({ queryKey: ["my-progress"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  return (
    <div className="bento p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Swords className="size-4 text-primary" /> Günlük KPSS Görevleri
        </h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-amber/20 px-2.5 py-1 text-xs font-bold">
          <Award className="size-3.5" /> {badges} şampiyonluk rozeti
        </span>
      </div>
      <button
        type="button"
        disabled={chestOpened || busy === "chest"}
        onClick={() => void openChest()}
        className={`mt-4 flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed p-3 text-left text-sm transition-transform ${chestOpened ? "border-border text-muted-foreground" : "border-amber bg-amber/10 font-semibold hover:scale-[1.01] motion-safe:animate-pulse"}`}
      >
        <span className="flex items-center gap-2"><Gift className="size-5 text-amber" /> {chestOpened ? "Bugünkü şans sandığını açtın. Yarın yine gel!" : "Günlük şans sandığın hazır! Aç ve sürpriz puanını kap"}</span>
        {!chestOpened && <span className="text-xs">10–100 puan</span>}
      </button>
      <ul className="mt-4 space-y-3">
        {QUESTS.map((q) => {
          const n = Math.min(q.target, q.count(todays));
          const done = claimed.has(q.id);
          return (
            <li key={q.id} className="rounded-xl bg-secondary p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{q.label}</span>
                {done ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-primary"><CheckCircle2 className="size-4" /> +{q.points}</span>
                ) : n >= q.target ? (
                  <Button size="sm" disabled={busy === q.id} onClick={() => void claim(q.id, q.points)}><Gift className="size-4" /> +{q.points} al</Button>
                ) : (
                  <span className="text-xs text-muted-foreground">{n}/{q.target} · +{q.points}</span>
                )}
              </div>
              <Progress value={(n / q.target) * 100} className="mt-2 h-1.5" />
            </li>
          );
        })}
      </ul>
      {allDone && !claimed.has("all") && (
        <Button className="mt-4 w-full" disabled={busy === "all"} onClick={() => void claim("all", BONUS)}>
          <Award className="size-4" /> Tüm görevler bitti — rozeti ve +{BONUS} puanı al
        </Button>
      )}
      {claimed.has("all") && <p className="mt-4 text-center text-sm font-semibold text-primary">🏆 Bugünün şampiyonu sensin! Yarın yeni görevler seni bekliyor.</p>}
    </div>
  );
}
