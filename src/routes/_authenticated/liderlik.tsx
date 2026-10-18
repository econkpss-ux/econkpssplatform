import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession, levelFromPoints } from "@/lib/auth";
import { Crown } from "lucide-react";

export const Route = createFileRoute("/_authenticated/liderlik")({
  head: () => ({
    meta: [
      { title: "Liderlik Tablosu — EconKPSS" },
      { name: "description", content: "EconKPSS topluluğunun en çok puan toplayan öğrencileri." },
      { property: "og:title", content: "Liderlik Tablosu — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "Sıralamada yüksel, rozetleri topla." },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { user } = useSession();
  const { data } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leaderboard", { _limit: 100 });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Liderlik Tablosu</h1>
        <p className="mt-1 text-muted-foreground">Puan topla, sıralamada yüksel.</p>
      </header>

      <ol className="bento divide-y divide-border p-2">
        {(data ?? []).map((p, i) => {
          const { level } = levelFromPoints(p.points);
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${
                p.id === user?.id ? "bg-primary/10" : ""
              }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-sm font-bold ${
                    i === 0 ? "gradient-warm text-brand-foreground" : "bg-secondary"
                  }`}
                >
                  {i === 0 ? <Crown className="size-4" /> : i + 1}
                </span>
                <span>
                  <span className="font-semibold">{p.full_name ?? "Öğrenci"}</span>
                  <span className="block text-xs text-muted-foreground">Seviye {level}</span>
                </span>
              </span>
              <span className="font-display text-lg font-bold">{p.points}</span>
            </li>
          );
        })}
        {!data?.length && (
          <li className="p-6 text-center text-muted-foreground">Henüz sıralama yok.</li>
        )}
      </ol>
    </div>
  );
}