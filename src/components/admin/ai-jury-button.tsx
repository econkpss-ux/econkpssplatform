import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { verifyQuestionWithJury, type VerifyResult } from "@/lib/ai-verify.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Check, X, HelpCircle } from "lucide-react";

/** 6 modelli yapay zeka jürisi ile soru doğruluğunu denetleyen buton. */
export function AiJuryButton({
  question,
  onApplyAnswer,
  size = "sm",
}: {
  question: {
    prompt: string;
    options: string[];
    correct_index: number;
    explanation?: string | null;
  };
  onApplyAnswer?: (index: number) => void | Promise<void>;
  size?: "sm" | "icon";
}) {
  const verify = useServerFn(verifyQuestionWithJury);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setOpen(true);
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await verify({
        data: {
          prompt: question.prompt,
          options: question.options,
          correct_index: question.correct_index,
          explanation: question.explanation ?? undefined,
        },
      });
      setResult(res);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Yapay zeka denetimi yapılamadı.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size={size}
        onClick={() => void run()}
        aria-label="Yapay zeka ile doğrula"
      >
        <Sparkles className="size-4" />
        {size === "sm" && <span className="ml-1">AI denetimi</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yapay Zeka Jürisi (6 model)</DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground">{question.prompt}</p>

          {loading && <p className="text-sm">6 model soruyu değerlendiriyor…</p>}

          {error && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          {result && (
            <div className="space-y-3">
              <div className="rounded-lg bg-secondary p-3 text-sm font-medium">
                {result.summary}
              </div>
              <ul className="space-y-2 text-sm">
                {result.verdicts.map((v) => (
                  <li
                    key={v.model}
                    className="flex items-start gap-2 rounded-lg border border-border p-2"
                  >
                    {v.ok === true ? (
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    ) : v.ok === false ? (
                      <X className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-semibold">{v.model}</p>
                      <p className="text-muted-foreground">
                        {v.note}
                        {v.ok === false && v.suggested_index !== null && (
                          <> · Önerilen: {String.fromCharCode(65 + v.suggested_index)}</>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            {result &&
              onApplyAnswer &&
              result.consensus_index !== null &&
              result.consensus_index !== question.correct_index && (
                <Button
                  onClick={() => {
                    void onApplyAnswer(result.consensus_index!);
                    setOpen(false);
                  }}
                >
                  Önerilen şıkkı uygula ({String.fromCharCode(65 + result.consensus_index)})
                </Button>
              )}
            <Button variant="outline" onClick={() => setOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
