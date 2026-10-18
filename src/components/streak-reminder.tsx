import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Bell, BellRing } from "lucide-react";
import { enablePush } from "@/lib/push";
import { useSession } from "@/lib/auth";

const KEY = "econkpss-reminders";

const MESSAGES: Record<string, string> = {
  "open-in-new-tab": "Bildirimleri açmak için platformu ayrı bir sekmede aç ve zile tekrar bas.",
  "install-required":
    "iPhone/iPad'de bildirimler için önce Paylaş menüsünden Ana Ekrana Ekle'yi seçip uygulamayı ana ekrandan aç.",
  denied: "Bildirim izni verilmedi. Tarayıcının site ayarlarından izin verebilirsin.",
  unsupported:
    "Bu tarayıcı bildirimleri desteklemiyor. iPhone/iPad'de siteyi ana ekrana ekleyip oradan aç.",
  "not-configured": "Bildirim sistemi şu an hazır değil, lütfen daha sonra tekrar dene.",
};

/** Platform kapalıyken de gelen günlük seri hatırlatmaları. */
export function StreakReminder() {
  const { user } = useSession();
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(
      "Notification" in window &&
        Notification.permission === "granted" &&
        localStorage.getItem(KEY) === "on",
    );
  }, []);

  async function toggle() {
    if (!user) return;
    if (enabled) {
      localStorage.setItem(KEY, "off");
      setEnabled(false);
      toast("Seri hatırlatmaları bu cihazda kapatıldı.");
      return;
    }
    setBusy(true);
    try {
      const status = await enablePush(user.id);
      if (status !== "registered") {
        toast.error(MESSAGES[status]);
        return;
      }
      localStorage.setItem(KEY, "on");
      setEnabled(true);
      toast.success(
        "Hatırlatmalar açık! Çalışmadığın günlerde akşam 20:00'de platform kapalı olsa bile seni uyaracağız.",
      );
    } catch (error) {
      console.error("Push notification registration failed:", error);
      const message = error instanceof Error ? error.message : "Bilinmeyen bildirim hatası.";
      toast.error(`Bildirimler açılamadı: ${message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={busy}
      onClick={() => void toggle()}
      aria-label={enabled ? "Seri hatırlatmalarını kapat" : "Seri hatırlatmalarını aç"}
      title={enabled ? "Hatırlatmalar açık" : "Seri hatırlatmalarını aç"}
    >
      {enabled ? <BellRing className="size-4 text-primary" /> : <Bell className="size-4" />}
    </Button>
  );
}
