import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { proposeFifthOptions } from "@/lib/five-option.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Check, RefreshCw } from "lucide-react";

type Row = { id: string; prompt: string; options: string[]; correct_index: number };
type Draft = Row & { fifth: string; position: number; error?: string | undefined };

/**
 * Tüm soruların 5 şıklı (A-B-C-D-E) olmasını sağlayan yönetici aracı.
 * Yapay zeka yalnızca öneri üretir; hiçbir değişiklik yönetici onayı olmadan uygulanmaz.
 */
export function FiveOptionTool() {
  const qc = useQueryClient();
  const propose = useServerFn(proposeFifthOptions);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: pending, refetch } = useQuery({
    queryKey: ["four-option-questions"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, prompt, options, correct_index")
        .limit(2000);
      if (error) throw error;
      return (data ?? [])
        .map((r) => ({
          id: r.id,
          prompt: r.prompt,
          options: Array.isArray(r.options) ? (r.options as string[]) : [],
          correct_index: r.correct_index ?? 0,
        }))
        .filter((r) => r.options.length < 5) as Row[];
    },
  });

  async function generate() {
    const batch = (pending ?? []).slice(0, 8);
    if (!batch.length) {
      toast.success("Tüm sorular zaten 5 şıklı 🎉");
      return;
    }
    setBusy(true);
    try {
      const { proposals } = await propose({
        data: {
          items: batch.map((b) => ({
            id: b.id,
            prompt: b.prompt,
            options: b.options,
            correct_index: b.correct_index,
          })),
        },
      });
      setDrafts(
        batch.map((b) => {
          const p = proposals.find((x) => x.id === b.id);
          return {
            ...b,
            fifth: p?.option ?? "",
            position: b.options.length,
            error: p?.error,
          };
        }),
      );
      toast.success("Öneriler hazır. Onaylamadan hiçbir soru değişmez.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Öneri üretilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function apply(draft: Draft) {
    const value = draft.fifth.trim();
    if (value.length < 1) {
      toast.error("Yeni şık boş olamaz.");
      return;
    }
    const options = [...draft.options];
    const pos = Math.min(Math.max(draft.position, 0), options.length);
    options.splice(pos, 0, value);
    const correct = draft.correct_index >= pos ? draft.correct_index + 1 : draft.correct_index;
    const { error } = await supabase
      .from("questions")
      .update({ options, correct_index: correct })
      .eq("id", draft.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
    toast.success("Soru 5 şıklı hale getirildi");
    qc.invalidateQueries({ queryKey: ["admin-question-bank"] });
    qc.invalidateQueries({ queryKey: ["questions"] });
    void refetch();
  }

  async function applyAll() {
    setBusy(true);
    for (const d of drafts.filter((x) => x.fifth.trim())) await apply(d);
    setBusy(false);
  }

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Sparkles className="size-4 text-primary" /> 5 Şık Dönüşümü (A–E)
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Platformdaki tüm sorular A-B-C-D-E olmak üzere 5 şıklı olmalıdır. Yapay zeka eksik şıkkı
        önerir, <strong>uygulamadan önce mutlaka sizin onayınızı bekler</strong>. Öneriyi
        düzenleyebilir veya kendiniz yazabilirsiniz.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold">
          Eksik şıklı soru: {pending?.length ?? 0}
        </span>
        <Button onClick={() => void generate()} disabled={busy}>
          <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} /> 8 soru için öneri üret
        </Button>
        {drafts.length > 1 && (
          <Button variant="outline" disabled={busy} onClick={() => void applyAll()}>
            <Check className="size-4" /> Tümünü onayla ve uygula
          </Button>
        )}
      </div>

      <ul className="mt-5 space-y-3">
        {drafts.map((d) => (
          <li key={d.id} className="rounded-xl bg-secondary p-4">
            <p className="font-medium">{d.prompt}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {d.options.map((o, i) => (
                <li key={i} className={i === d.correct_index ? "font-semibold text-primary" : "text-muted-foreground"}>
                  {String.fromCharCode(65 + i)}) {o}
                </li>
              ))}
            </ul>
            {d.error && <p className="mt-2 text-xs text-destructive">Yapay zeka: {d.error}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                className="max-w-md"
                value={d.fifth}
                maxLength={200}
                placeholder="Yeni (yanlış) şık metni"
                onChange={(e) =>
                  setDrafts((prev) =>
                    prev.map((x) => (x.id === d.id ? { ...x, fifth: e.target.value } : x)),
                  )
                }
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                value={String(d.position)}
                onChange={(e) =>
                  setDrafts((prev) =>
                    prev.map((x) => (x.id === d.id ? { ...x, position: Number(e.target.value) } : x)),
                  )
                }
              >
                {Array.from({ length: d.options.length + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {String.fromCharCode(65 + i)} sırasına ekle
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => void apply(d)} disabled={busy}>
                <Check className="size-4" /> Onayla
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDrafts((prev) => prev.filter((x) => x.id !== d.id))}
              >
                Atla
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
