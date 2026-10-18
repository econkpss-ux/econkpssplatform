import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/confirm-button";
import { Flag, Trash2 } from "lucide-react";

type ReportRow = {
  id: string;
  content_type: string;
  content_id: string;
  content_preview: string | null;
  reason: string;
  status: string;
  created_at: string;
};

const LABEL: Record<string, string> = {
  question: "Soru",
  flashcard: "Kart",
  match: "Eşleştirme",
};

/** Kullanıcıların bildirdiği hatalı içerikler. */
export function ReportsPanel() {
  const qc = useQueryClient();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["admin-reports"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as ReportRow[];
    },
  });

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("content_reports").update({ status }).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "resolved" ? "Bildirim çözüldü" : "Bildirim yoksayıldı");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  async function removeReport(id: string) {
    const { error } = await supabase.from("content_reports").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  const open = (rows ?? []).filter((r) => r.status === "open");

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Flag className="size-4 text-destructive" /> Hatalı İçerik Bildirimleri ({open.length} açık)
      </h2>
      {isLoading && <p className="mt-4 text-sm text-muted-foreground">Yükleniyor…</p>}
      {!isLoading && !rows?.length && (
        <p className="mt-4 text-sm text-muted-foreground">Henüz bildirim yok.</p>
      )}
      <ul className="mt-4 space-y-3">
        {(rows ?? []).map((r) => (
          <li key={r.id} className="rounded-xl bg-secondary p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                {LABEL[r.content_type] ?? r.content_type}
              </span>
              <span
                className={`rounded px-2 py-0.5 font-semibold ${
                  r.status === "open" ? "bg-destructive/10 text-destructive" : "bg-mint/20"
                }`}
              >
                {r.status === "open" ? "Açık" : r.status === "resolved" ? "Çözüldü" : "Yoksayıldı"}
              </span>
              <span className="text-muted-foreground">
                {new Date(r.created_at).toLocaleString("tr-TR")}
              </span>
            </div>
            {r.content_preview && <p className="mt-2 font-medium">{r.content_preview}</p>}
            <p className="mt-1 text-sm text-muted-foreground">Gerekçe: {r.reason}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.status === "open" && (
                <>
                  <Button size="sm" onClick={() => void setStatus(r.id, "resolved")}>
                    Çözüldü olarak işaretle
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void setStatus(r.id, "dismissed")}>
                    Yoksay
                  </Button>
                </>
              )}
              <ConfirmButton
                trigger={
                  <Button size="sm" variant="ghost">
                    <Trash2 className="size-4 text-destructive" /> Sil
                  </Button>
                }
                title="Bildirim silinsin mi?"
                description="Bu bildirim kalıcı olarak silinecek."
                onConfirm={() => removeReport(r.id)}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
