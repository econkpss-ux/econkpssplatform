import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, LogIn, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const formatter = new Intl.DateTimeFormat("tr-TR", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDate(value: string | null) {
  return value ? formatter.format(new Date(value)) : "Henüz giriş kaydı yok";
}

const activityLabels: Record<string, string> = {
  question: "Soru çözdü",
  flashcard: "Bilgi kartı çalıştı",
  match: "Eşleştirme yaptı",
};

export function ActivityPanel() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["admin-user-activity"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const recentSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: activity, error } = await supabase.rpc("get_admin_user_activity", {
        _since: recentSince,
      });
      if (error) throw error;
      return activity;
    },
  });

  return (
    <section className="bento p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Activity className="size-5 text-primary" />
            Kullanıcı aktiviteleri
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Son giriş zamanı ve son 30 gündeki çalışma hareketleri
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isPending}>
          <RotateCw className={`size-4 ${isPending ? "animate-spin" : ""}`} />
          Yenile
        </Button>
      </div>

      {isError ? (
        <p role="alert" className="mt-4 text-sm text-destructive">
          Aktivite bilgileri yüklenemedi:{" "}
          {error instanceof Error ? error.message : "Bilinmeyen hata"}
        </p>
      ) : isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Kullanıcı aktiviteleri yükleniyor…</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Kullanıcı</th>
                <th className="py-2 pr-3">Son giriş</th>
                <th className="py-2 pr-3">Son çalışma hareketi</th>
                <th className="py-2">30 günlük hareket</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((profile) => (
                <tr key={profile.user_id} className="border-t border-border align-top">
                  <td className="py-3 pr-3">
                    <p className="font-medium">{profile.full_name ?? "İsimsiz kullanıcı"}</p>
                    <p className="text-xs text-muted-foreground">{profile.email ?? "—"}</p>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <LogIn className="size-3.5 shrink-0" />
                      {formatDate(profile.last_login_at)}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {profile.last_activity_at ? (
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="size-3.5 shrink-0" />
                        {activityLabels[profile.last_activity_kind ?? ""] ?? "Çalışma yaptı"} ·{" "}
                        {formatDate(profile.last_activity_at)}
                      </span>
                    ) : (
                      "Son 30 günde hareket yok"
                    )}
                  </td>
                  <td className="py-3">{profile.activity_count} etkinlik</td>
                </tr>
              ))}
              {!data?.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    Kayıtlı kullanıcı bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Mevcut son giriş zamanı dahildir; sonraki girişler otomatik kaydedilir.
          </p>
        </div>
      )}
    </section>
  );
}
