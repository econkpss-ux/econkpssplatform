import { supabase } from "@/integrations/supabase/client";

export type Subject = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
};

export const subjectsQuery = {
  queryKey: ["subjects"],
  queryFn: async (): Promise<Subject[]> => {
    const { data, error } = await supabase.from("subjects").select("*").order("sort_order");
    if (error) throw error;
    return data as Subject[];
  },
};

export async function awardPoints(input: {
  userId: string;
  subjectId: string | null;
  topic?: string | null;
  kind: string;
  isCorrect: boolean | null;
  points: number;
  contentId?: string | null;
}) {
  const { error } = await supabase.from("progress_events").insert({
    user_id: input.userId,
    subject_id: input.subjectId,
    topic: input.topic ?? null,
    kind: input.kind,
    is_correct: input.isCorrect,
    points: input.points,
    content_id: input.contentId ?? null,
  });
  if (error) throw error;
}

/** Fisher-Yates: her oturumda içerik sırası değişsin diye. */
export function shuffleArray<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export const SUBJECT_TONE: Record<string, string> = {
  amber: "bg-amber/15 text-amber-foreground",
  emerald: "bg-mint/15",
  blue: "bg-primary/10",
  violet: "bg-violet/15",
  rose: "bg-rose/15",
};