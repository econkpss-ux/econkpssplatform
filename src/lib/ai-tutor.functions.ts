import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  prompt: z.string().min(3).max(1200),
  correct: z.string().min(1).max(400),
  picked: z.string().max(400).optional(),
  topic: z.string().max(120).optional(),
});

export type TutorAnswer = { text: string };

/** Yanlış yapılan bir soruyu öğrenciye sade Türkçe ile açıklayan AI destek. */
export const explainMistake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<TutorAnswer> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI anahtarı yapılandırılmamış");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "Sen sıcakkanlı bir KPSS koçusun. Öğrenci soruyu yanlış yaptı. Kısa (en fazla 120 kelime), sade Türkçe, maddeler halinde açıkla: 1) doğru cevabın nedeni, 2) öğrencinin muhtemel kafa karışıklığı, 3) akılda kalıcı küçük bir ipucu. Motive edici bir cümleyle bitir. Markdown başlığı kullanma.",
          },
          {
            role: "user",
            content: `Konu: ${data.topic ?? "-"}\nSoru: ${data.prompt}\nDoğru cevap: ${data.correct}\nÖğrencinin cevabı: ${data.picked ?? "-"}`,
          },
        ],
      }),
    });

    if (res.status === 429) throw new Error("Şu an çok yoğunuz, biraz sonra tekrar dene.");
    if (res.status === 402) throw new Error("AI kredisi tükendi. Yönetici ekibiyle iletişime geç.");
    if (!res.ok) throw new Error("AI desteği şu an yanıt veremedi.");

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("AI desteği boş yanıt döndü.");
    return { text: text.slice(0, 2000) };
  });
