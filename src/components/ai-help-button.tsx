import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { explainMistake } from "@/lib/ai-tutor.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Bot, Loader2 } from "lucide-react";

/** Yanlış yapılan içeriğin altında görünen "AI Destek" butonu. */
export function AiHelpButton({
  prompt,
  correct,
  picked,
  topic,
  className,
}: {
  prompt: string;
  correct: string;
  picked?: string | undefined;
  topic?: string | null;
  className?: string;
}) {
  const explain = useServerFn(explainMistake);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");

  async function run() {
    setOpen(true);
    if (text) return;
    setLoading(true);
    try {
      const res = await explain({
        data: { prompt, correct, picked, topic: topic ?? undefined },
      });
      setText(res.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI desteği alınamadı.");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => void run()}>
        <Bot className="size-4" /> AI Destek
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="size-5 text-primary" /> AI Destek
            </DialogTitle>
          </DialogHeader>
          <p className="rounded-lg bg-secondary p-3 text-sm font-medium">{prompt}</p>
          {loading ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Koçun düşünüyor…
            </p>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
