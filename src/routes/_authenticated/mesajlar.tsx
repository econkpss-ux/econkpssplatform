import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Mail, MailOpen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mesajlar")({
  head: () => ({
    meta: [
      { title: "Mesajlarım — EconKPSS" },
      {
        name: "description",
        content: "Yönetici ekibinden gelen kişisel bilgilendirme mesajlarını buradan oku.",
      },
      { property: "og:title", content: "Mesajlarım — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "EconKPSS yönetici ekibinden gelen özel mesajlar." },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { user } = useSession();
  const qc = useQueryClient();

  const { data: messages } = useQuery({
    queryKey: ["my-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_messages")
        .select("id, subject, body, read_at, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function markRead(id: string) {
    await supabase.from("user_messages").update({ read_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["my-messages", user?.id] });
    qc.invalidateQueries({ queryKey: ["unread-messages", user?.id] });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Mesajlarım</h1>
        <p className="mt-1 text-muted-foreground">
          Yönetici ekibinin sana özel gönderdiği bilgilendirmeler burada listelenir.
        </p>
      </header>

      <ul className="space-y-3">
        {(messages ?? []).map((m) => (
          <li
            key={m.id}
            className={`bento p-5 ${m.read_at ? "" : "border-primary/40 ring-1 ring-primary/20"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-bold">
                {m.read_at ? (
                  <MailOpen className="size-4 text-muted-foreground" />
                ) : (
                  <Mail className="size-4 text-primary" />
                )}
                {m.subject}
              </h2>
              <span className="text-xs text-muted-foreground">
                {new Date(m.created_at).toLocaleString("tr-TR")}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
            {!m.read_at && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => void markRead(m.id)}>
                Okundu olarak işaretle
              </Button>
            )}
          </li>
        ))}
        {!messages?.length && (
          <li className="bento p-10 text-center text-muted-foreground">
            Henüz bir mesajın yok. 📭
          </li>
        )}
      </ul>
    </div>
  );
}
