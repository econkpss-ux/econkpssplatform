import { useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ContentType = "question" | "flashcard" | "match_pair";

export function ReportButton({
  contentType,
  contentId,
  preview,
}: {
  contentType: ContentType;
  contentId: string;
  preview: string;
}) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!user) return;
    if (reason.trim().length < 5) {
      toast.error("Lütfen hatayı kısaca açıkla.");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("content_reports").insert({
      user_id: user.id,
      content_type: contentType,
      content_id: contentId,
      content_preview: preview.slice(0, 300),
      reason: reason.trim().slice(0, 500),
    });
    setSending(false);
    if (error) {
      toast.error("Bildirim gönderilemedi.");
      return;
    }
    toast.success("Teşekkürler! Yönetici ekibine bildirildi.");
    setReason("");
    setOpen(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Flag className="size-4" /> Hatalı soruyu bildir
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yönetici ekibine bildir</DialogTitle>
            <DialogDescription>
              Bu içerikte gördüğün hatayı yaz; ekip en kısa sürede kontrol edip düzeltecek.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg bg-secondary p-3 text-sm">{preview}</p>
          <Textarea
            placeholder="ör. Doğru cevap yanlış işaretlenmiş, doğrusu 18 olmalı."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={send} disabled={sending}>
              Bildir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}