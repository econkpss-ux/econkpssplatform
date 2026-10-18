import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";

function EditTrigger() {
  return (
    <Button variant="ghost" size="icon" aria-label="Düzenle">
      <Pencil className="size-4" />
    </Button>
  );
}

/** Bilgi kartı düzenleme. */
export function EditFlashcardDialog({
  card,
}: {
  card: { id: string; front: string; back?: string | null; topic: string | null };
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back ?? "");
  const [topic, setTopic] = useState(card.topic ?? "");
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await supabase.from("flashcards").select("front, back, topic").eq("id", card.id).maybeSingle();
    if (data) {
      setFront(data.front);
      setBack(data.back);
      setTopic(data.topic ?? "");
    }
  }

  async function save() {
    if (front.trim().length < 3 || back.trim().length < 1) {
      toast.error("Ön ve arka yüz zorunludur.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("flashcards")
      .update({ front: front.trim(), back: back.trim(), topic: topic.trim() || null })
      .eq("id", card.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Kart güncellendi");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-flashcards"] });
    qc.invalidateQueries({ queryKey: ["flashcards"] });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <DialogTrigger asChild>
        <EditTrigger />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kartı düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Konu</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Ön yüz</Label>
            <Textarea value={front} onChange={(e) => setFront(e.target.value)} maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label>Arka yüz</Label>
            <Textarea value={back} onChange={(e) => setBack(e.target.value)} maxLength={600} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={loading}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Soru düzenleme (metin, şıklar, doğru cevap, açıklama). */
export function EditQuestionDialog({ questionId }: { questionId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [topic, setTopic] = useState("");
  const [options, setOptions] = useState<string[]>(["", "", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState(2);
  const [loading, setLoading] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("questions")
      .select("prompt, topic, options, correct_index, explanation, difficulty")
      .eq("id", questionId)
      .maybeSingle();
    if (!data) return;
    setPrompt(data.prompt);
    setTopic(data.topic ?? "");
    setOptions(Array.isArray(data.options) ? (data.options as string[]) : ["", "", "", "", ""]);
    setCorrect(data.correct_index ?? 0);
    setExplanation(data.explanation ?? "");
    setDifficulty(data.difficulty ?? 2);
  }

  async function save() {
    if (prompt.trim().length < 5 || options.length !== 5 || options.some((o) => !o.trim())) {
      toast.error("Soru metni ve 5 şık (A-E) zorunludur.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("questions")
      .update({
        prompt: prompt.trim(),
        topic: topic.trim() || null,
        options: options.map((o) => o.trim()),
        correct_index: correct,
        explanation: explanation.trim() || null,
        difficulty,
      })
      .eq("id", questionId);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Soru güncellendi");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-question-bank"] });
    qc.invalidateQueries({ queryKey: ["questions"] });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void load();
      }}
    >
      <DialogTrigger asChild>
        <EditTrigger />
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Soruyu düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Konu</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Soru metni</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={600} />
          </div>
          <div className="space-y-2">
            <Label>Şıklar A–E (doğru olanı işaretle)</Label>
            {options.map((o, i) => (
              <label key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`edit-correct-${questionId}`}
                  checked={correct === i}
                  onChange={() => setCorrect(i)}
                />
                <span className="w-5 text-sm font-bold text-muted-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
                <Input
                  value={o}
                  maxLength={200}
                  onChange={(e) =>
                    setOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                  }
                />
              </label>
            ))}
            {options.length < 5 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOptions((prev) => [...prev, ""])}
              >
                Şık ekle ({options.length}/5)
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Zorluk</Label>
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={String(difficulty)}
              onChange={(e) => setDifficulty(Number(e.target.value))}
            >
              <option value="1">Kolay</option>
              <option value="2">Orta</option>
              <option value="3">Zor</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Açıklama</Label>
            <Textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              maxLength={600}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={loading}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Eşleştirme çifti düzenleme. */
export function EditPairDialog({
  pair,
}: {
  pair: { id: string; left_text: string; right_text: string; topic: string | null };
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(pair.left_text);
  const [right, setRight] = useState(pair.right_text);
  const [topic, setTopic] = useState(pair.topic ?? "");
  const [loading, setLoading] = useState(false);

  async function loadPair() {
    const { data, error } = await supabase.from("match_pairs").select("left_text, right_text, topic").eq("id", pair.id).maybeSingle();
    if (error) { toast.error("Eşleştirme yüklenemedi."); return; }
    if (data) { setLeft(data.left_text); setRight(data.right_text); setTopic(data.topic ?? ""); }
  }

  async function save() {
    if (!left.trim() || !right.trim()) {
      toast.error("İki taraf da zorunludur.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("match_pairs")
      .update({ left_text: left.trim(), right_text: right.trim(), topic: topic.trim() || null })
      .eq("id", pair.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Eşleştirme güncellendi");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-pairs"] });
    qc.invalidateQueries({ queryKey: ["match-pairs"] });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) void loadPair(); }}>
      <DialogTrigger asChild>
        <EditTrigger />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eşleştirmeyi düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Konu</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Sol taraf</Label>
            <Input value={left} onChange={(e) => setLeft(e.target.value)} maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label>Sağ taraf</Label>
            <Input value={right} onChange={(e) => setRight(e.target.value)} maxLength={200} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => void save()} disabled={loading}>
            Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "Bu içerik zaten var, yine de ekleyeyim mi?" onay penceresi. */
export function DuplicateWarningDialog({
  open,
  onOpenChange,
  onConfirm,
  preview,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  preview: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bu içerik daha önce eklenmiş</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Platformda benzer bir kayıt bulundu: “{preview}”. Yine de eklemek istiyor musunuz?
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Vazgeç
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              onConfirm();
            }}
          >
            Yine de ekle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
