import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { subjectsQuery } from "@/lib/econ";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/confirm-button";
import { EditQuestionDialog } from "@/components/admin/edit-dialogs";
import { AiJuryButton } from "@/components/admin/ai-jury-button";
import { Library, Trash2 } from "lucide-react";

type QuestionRow = {
  id: string;
  subject_id: string;
  topic: string | null;
  prompt: string;
  options: unknown;
  correct_index: number;
  explanation: string | null;
  difficulty: number;
  created_at: string;
};

export const DIFFICULTY_LABEL: Record<number, string> = { 1: "Kolay", 2: "Orta", 3: "Zor" };

/** Yayınlanmış tüm soruların yönetimi: görüntüle, düzenle, sil, AI ile denetle. */
export function QuestionBank() {
  const qc = useQueryClient();
  const { data: subjects } = useQuery(subjectsQuery);
  const [search, setSearch] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-question-bank"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, subject_id, topic, prompt, options, correct_index, explanation, difficulty, created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data as QuestionRow[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (!subjectId || r.subject_id === subjectId) &&
        (!difficulty || String(r.difficulty ?? 2) === difficulty) &&
        (!q || r.prompt.toLowerCase().includes(q) || (r.topic ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search, subjectId, difficulty]);

  const subjectName = (id: string) => (subjects ?? []).find((s) => s.id === id)?.name ?? "—";

  async function remove(id: string) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Soru silindi");
    qc.invalidateQueries({ queryKey: ["admin-question-bank"] });
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["questions"] });
  }

  async function setAnswer(id: string, index: number) {
    const { error } = await supabase.from("questions").update({ correct_index: index }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Doğru cevap güncellendi");
    qc.invalidateQueries({ queryKey: ["admin-question-bank"] });
    qc.invalidateQueries({ queryKey: ["questions"] });
  }

  async function setDifficultyOf(id: string, value: number) {
    const { error } = await supabase.from("questions").update({ difficulty: value }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-question-bank"] });
  }

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Library className="size-4 text-primary" /> Yayınlanmış Sorular ({filtered.length})
      </h2>

      <div className="mt-4 grid gap-2 md:grid-cols-3">
        <Input placeholder="Soru veya konu ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="">Tüm dersler</option>
          {(subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          <option value="">Tüm zorluklar</option>
          <option value="1">Kolay</option>
          <option value="2">Orta</option>
          <option value="3">Zor</option>
        </select>
      </div>

      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>}
      {!isLoading && !filtered.length && (
        <p className="mt-4 text-sm text-muted-foreground">Bu filtreye uyan soru yok.</p>
      )}

      <ul className="mt-4 space-y-3">
        {filtered.slice(0, 300).map((row) => {
          const options = Array.isArray(row.options) ? (row.options as string[]) : [];
          return (
            <li key={row.id} className="rounded-xl bg-secondary p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                  {subjectName(row.subject_id)}
                </span>
                {row.topic && <span className="text-muted-foreground">{row.topic}</span>}
                <select
                  className="rounded border border-input bg-background px-2 py-0.5 text-xs"
                  value={String(row.difficulty ?? 2)}
                  onChange={(e) => void setDifficultyOf(row.id, Number(e.target.value))}
                >
                  <option value="1">Kolay</option>
                  <option value="2">Orta</option>
                  <option value="3">Zor</option>
                </select>
              </div>
              <p className="mt-2 font-medium">{row.prompt}</p>
              <ul className="mt-2 space-y-1 text-sm">
                {options.map((o, i) => (
                  <li key={i} className={i === row.correct_index ? "font-semibold text-primary" : "text-muted-foreground"}>
                    {String.fromCharCode(65 + i)}) {o}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <EditQuestionDialog questionId={row.id} />
                <AiJuryButton
                  question={{
                    prompt: row.prompt,
                    options,
                    correct_index: row.correct_index,
                    explanation: row.explanation,
                  }}
                  onApplyAnswer={(index) => setAnswer(row.id, index)}
                />
                <ConfirmButton
                  trigger={
                    <Button variant="ghost" size="icon" aria-label="Sil">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  }
                  title="Soru silinsin mi?"
                  description="Bu soru kalıcı olarak silinecek. Emin misiniz?"
                  confirmLabel="Evet, sil"
                  onConfirm={() => remove(row.id)}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {filtered.length > 300 && (
        <p className="mt-3 text-xs text-muted-foreground">
          İlk 300 soru gösteriliyor. Aramayı daraltarak diğerlerine ulaşabilirsin.
        </p>
      )}
    </section>
  );
}
