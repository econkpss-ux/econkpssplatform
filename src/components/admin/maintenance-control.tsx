import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getSiteSettings, SITE_SETTINGS_QUERY_KEY } from "@/lib/site-settings";

const defaultTitle = "Kısa bir bakım molası";
const defaultMessage =
  "Sitemizde planlı bakım çalışması yapılıyor. Kısa süre içinde tekrar buradayız.";

export function MaintenanceControl() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState(defaultMessage);
  const [isDirty, setIsDirty] = useState(false);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: getSiteSettings,
  });

  useEffect(() => {
    if (data && !isDirty) {
      setTitle(data.maintenance_title);
      setMessage(data.maintenance_message);
    }
  }, [data, isDirty]);

  const updateSettings = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: updated, error: updateError } = await supabase
        .from("site_settings")
        .update({
          maintenance_enabled: enabled,
          maintenance_title: title.trim() || defaultTitle,
          maintenance_message: message.trim() || defaultMessage,
        })
        .eq("id", 1)
        .select("id, maintenance_enabled, maintenance_title, maintenance_message, updated_at")
        .single();
      if (updateError) throw updateError;
      return updated;
    },
    onSuccess: async (updated) => {
      queryClient.setQueryData(SITE_SETTINGS_QUERY_KEY, updated);
      setIsDirty(false);
      await queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
      toast.success(
        updated.maintenance_enabled
          ? "Bakım modu açıldı. Değişiklik kullanıcıların ekranına anında yansıyacak."
          : "Bakım modu kapatıldı. Site tekrar erişime açık.",
      );
    },
    onError: (updateError) => {
      console.error("Unable to update site maintenance settings.", updateError);
      toast.error(
        `Bakım modu güncellenemedi: ${
          updateError instanceof Error ? updateError.message : "Bilinmeyen hata"
        }`,
      );
    },
  });

  if (isError || isPending || !data) {
    return (
      <section className="bento p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Wrench className="size-5 text-primary" />
          Bakım modu
        </h2>
        <p role="alert" className="mt-3 text-sm text-destructive">
          {isError
            ? `Bakım ayarları yüklenemedi: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`
            : "Bakım ayarları yükleniyor…"}
        </p>
        {isError && (
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Tekrar dene
          </Button>
        )}
      </section>
    );
  }

  return (
    <section className="bento p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Wrench className="size-5 text-primary" />
            Canlı bakım modu
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Etkinleştirildiğinde ziyaretçiler ve öğrenciler bakım ekranına alınır. Yönetici ekibi
            siteye ve yönetim paneline erişmeye devam eder.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            data?.maintenance_enabled ? "bg-amber/15 text-amber-foreground" : "bg-mint/15 text-mint"
          }`}
        >
          {data?.maintenance_enabled ? (
            <AlertTriangle className="size-4" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {data?.maintenance_enabled ? "Bakım açık" : "Site yayında"}
        </span>
      </div>

      <label className="mt-5 block space-y-2 text-sm font-medium">
        Bakım ekranı başlığı
        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value.slice(0, 100));
            setIsDirty(true);
          }}
          maxLength={100}
          disabled={updateSettings.isPending}
          placeholder={defaultTitle}
        />
        <span className="block text-right text-xs font-normal text-muted-foreground">
          {title.length}/100
        </span>
      </label>

      <label className="mt-4 block space-y-2 text-sm font-medium">
        Bakım ekranı açıklaması
        <Textarea
          value={message}
          onChange={(event) => {
            setMessage(event.target.value.slice(0, 300));
            setIsDirty(true);
          }}
          maxLength={300}
          disabled={updateSettings.isPending}
          placeholder={defaultMessage}
          rows={3}
        />
        <span className="block text-right text-xs font-normal text-muted-foreground">
          {message.length}/300
        </span>
      </label>

      <Button
        type="button"
        variant={data?.maintenance_enabled ? "outline" : "destructive"}
        className="mt-2"
        disabled={updateSettings.isPending}
        onClick={() => updateSettings.mutate(!data?.maintenance_enabled)}
      >
        {updateSettings.isPending
          ? "Güncelleniyor…"
          : data?.maintenance_enabled
            ? "Bakım modunu kapat"
            : "Bakım modunu hemen aç"}
      </Button>
      <Button
        type="button"
        variant="outline"
        className="ml-2 mt-2"
        disabled={!isDirty || updateSettings.isPending}
        onClick={() => updateSettings.mutate(data.maintenance_enabled)}
      >
        Başlık ve yazıyı kaydet
      </Button>
    </section>
  );
}
