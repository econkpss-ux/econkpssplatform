import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { subjectsQuery } from "@/lib/econ";
import { AiJuryButton } from "@/components/admin/ai-jury-button";
import { Inbox, Check, X } from "lucide-react";

type PendingRow = {
  id: string;
  batch_id: string;
  subject_id: string;
  kind: string;
  topic: string | null;
  prompt: string;
  options: unknown;
  correct_index: number | null;
  explanation: string | null;
  answer: string | null;
  status: string;
  difficulty: number | null;
  created_at: string;
};

/** Yapay zekânın ürettiği, yönetici onayı bekleyen içerik kuyruğu. */
export function PendingQueue() {
  const qc = useQueryClient();
  const { data: subjects } = useQuery(subjectsQuery);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-pending"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pending_content")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as PendingRow[];
    },
  });

  const subjectName = (id: string) => (subjects ?? []).find((s) => s.id === id)?.name ?? "—";

  async function approve(row: PendingRow) {
    let error = null;
    if (row.kind === "question") {
      const options = Array.isArray(row.options) ? (row.options as string[]) : [];
      if (options.length !== 4) {
        toast.error("Bu soruda 4 şık yok, onaylanamadı.");
        return;
      }
      ({ error } = await supabase.from("questions").insert({
        subject_id: row.subject_id,
        topic: row.topic,
        prompt: row.prompt,
        options,
        correct_index: row.correct_index ?? 0,
        explanation: row.explanation,
        difficulty: row.difficulty ?? 2,
        auto_generated: true,
      }));
    } else if (row.kind === "flashcard") {
      ({ error } = await supabase.from("flashcards").insert({
        subject_id: row.subject_id,
        topic: row.topic,
        front: row.prompt,
        back: row.answer ?? "",
        auto_generated: true,
      }));
    } else {
      ({ error } = await supabase.from("match_pairs").insert({
        subject_id: row.subject_id,
        topic: row.topic,
        left_text: row.prompt,
        right_text: row.answer ?? "",
        auto_generated: true,
      }));
    }
    if (error) {
      toast.error(
        error.message.includes("duplicate")
          ? "Bu içerik zaten platformda mevcut."
          : error.message,
      );
      return;
    }
    await supabase.from("pending_content").update({ status: "approved" }).eq("id", row.id);
    toast.success("İçerik yayınlandı");
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-question-bank"] });
    qc.invalidateQueries({ queryKey: ["admin-flashcards"] });
    qc.invalidateQueries({ queryKey: ["admin-pairs"] });
  }

  async function setPendingAnswer(id: string, index: number) {
    const { error } = await supabase.from("pending_content").update({ correct_index: index }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Doğru cevap güncellendi");
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
  }

  async function reject(id: string) {
    const { error } = await supabase.from("pending_content").update({ status: "rejected" }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("İçerik reddedildi");
    qc.invalidateQueries({ queryKey: ["admin-pending"] });
  }

  async function approveAll() {
    for (const row of rows ?? []) await approve(row);
  }

  return (
    <section className="bento p-4 sm:p-6">
      <div className="grid min-w-0 grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-bold sm:text-lg">
          <Inbox className="size-4 shrink-0 text-primary" /> <span>Onay Bekleyen İçerikler ({rows?.length ?? 0})</span>
        </h2>
        {!!rows?.length && (
          <ConfirmButton
            trigger={<Button size="sm">Tümünü onayla</Button>}
            title="Tüm içerikler yayınlansın mı?"
            description="Onay bekleyen tüm içerikler platforma eklenecek."
            confirmLabel="Evet, yayınla"
            onConfirm={approveAll}
          />
        )}
      </div>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>}
      {!isLoading && !rows?.length && (
        <p className="mt-4 text-sm text-muted-foreground">
          Şu an onay bekleyen içerik yok. Saat başı üretilen sorular burada listelenir.
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {(rows ?? []).map((row) => {
          const options = Array.isArray(row.options) ? (row.options as string[]) : [];
          return (
            <li key={row.id} className="min-w-0 break-words rounded-lg bg-secondary p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  {row.kind === "question" ? "Soru" : row.kind === "flashcard" ? "Kart" : "Eşleştirme"}
                </span>
                <span className="text-muted-foreground">{subjectName(row.subject_id)}</span>
                {row.topic && <span className="text-muted-foreground">· {row.topic}</span>}
                {row.kind === "question" && (
                  <span className="rounded bg-background px-2 py-0.5 font-semibold">
                    {row.difficulty === 1 ? "Kolay" : row.difficulty === 3 ? "Zor" : "Orta"}
                  </span>
                )}
              </div>
              <p className="mt-2 font-medium">{row.prompt}</p>
              {options.length > 0 ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {options.map((o, i) => (
                    <li
                      key={i}
                      className={i === (row.correct_index ?? 0) ? "font-semibold text-primary" : "text-muted-foreground"}
                    >
                      {String.fromCharCode(65 + i)}) {o}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Cevap: {row.answer}</p>
              )}
              {row.explanation && (
                <p className="mt-2 text-xs text-muted-foreground">{row.explanation}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void approve(row)}>
                  <Check className="size-4" /> Onayla
                </Button>
                {row.kind === "question" && options.length === 4 && (
                  <AiJuryButton
                    question={{
                      prompt: row.prompt,
                      options,
                      correct_index: row.correct_index ?? 0,
                      explanation: row.explanation,
                    }}
                    onApplyAnswer={(index) => setPendingAnswer(row.id, index)}
                  />
                )}
                <ConfirmButton
                  trigger={
                    <Button size="sm" variant="outline">
                      <X className="size-4" /> Reddet
                    </Button>
                  }
                  title="İçerik reddedilsin mi?"
                  description="Bu içerik platforma eklenmeyecek."
                  confirmLabel="Evet, reddet"
                  onConfirm={() => reject(row.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
