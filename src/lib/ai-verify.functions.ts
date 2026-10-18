import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Jüri: 6 farklı yapay zeka modeli aynı soruyu bağımsız değerlendirir. */
const JURY = [
  { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash" },
  { id: "google/gemini-3.6-flash", label: "Gemini 3.6 Flash" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
  { id: "openai/gpt-5.4", label: "GPT-5.4" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 mini" },
] as const;

const inputSchema = z.object({
  prompt: z.string().min(3).max(1200),
  options: z.array(z.string().max(300)).min(2).max(6),
  correct_index: z.number().int().min(0).max(5),
  explanation: z.string().max(1200).optional(),
});

export type JuryVerdict = {
  model: string;
  ok: boolean | null;
  suggested_index: number | null;
  note: string;
};

export type VerifyResult = {
  verdicts: JuryVerdict[];
  agree: number;
  disagree: number;
  consensus_index: number | null;
  summary: string;
};

function getHttpErrorNote(status: number, body: string): string {
  const statusMessage =
    status === 401 || status === 403
      ? "AI erişim yetkisi reddedildi"
      : status === 402
        ? "AI kullanım kredisi yetersiz"
        : status === 404
          ? "Model veya istek biçimi bulunamadı"
          : status === 429
            ? "AI istek kotası aşıldı"
            : status >= 500
              ? "AI sağlayıcısı geçici olarak kullanılamıyor"
              : "AI isteği reddedildi";

  let detail = "";
  if (body) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (parsed && typeof parsed === "object") {
        const record = parsed as { error?: unknown; message?: unknown };
        if (typeof record.error === "string") detail = record.error;
        else if (record.error && typeof record.error === "object") {
          const error = record.error as { message?: unknown };
          if (typeof error.message === "string") detail = error.message;
        }
        if (!detail && typeof record.message === "string") detail = record.message;
      }
    } catch {
      detail = body;
    }
  }

  detail = detail
    .replace(/Bearer\s+\S+/gi, "Bearer [gizlendi]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[gizlendi]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return `HTTP ${status}: ${statusMessage}${detail ? ` — ${detail}` : ""}`;
}

async function askModel(
  model: { id: string; label: string },
  apiKey: string,
  data: z.infer<typeof inputSchema>,
): Promise<JuryVerdict> {
  const letters = data.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n");
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model.id,
        messages: [
          {
            role: "system",
            content:
              "Sen Türkiye KPSS sınavı uzmanısın. Verilen çoktan seçmeli sorunun bilgi doğruluğunu ve işaretlenen doğru şıkkın gerçekten doğru olup olmadığını denetlersin. Sadece istenen JSON'u döndür.",
          },
          {
            role: "user",
            content: `Soru: ${data.prompt}\nŞıklar:\n${letters}\nİşaretlenen doğru şık: ${String.fromCharCode(65 + data.correct_index)}\nAçıklama: ${data.explanation ?? "-"}\n\nBu soru bilgi olarak doğru mu ve işaretlenen şık doğru cevap mı?`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "verdict",
              description: "Denetim sonucu",
              parameters: {
                type: "object",
                properties: {
                  ok: { type: "boolean" },
                  suggested_index: { type: "number" },
                  note: { type: "string" },
                },
                required: ["ok", "suggested_index", "note"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "verdict" } },
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      return {
        model: model.label,
        ok: null,
        suggested_index: null,
        note: getHttpErrorNote(res.status, body),
      };
    }
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { model: model.label, ok: null, suggested_index: null, note: "Boş yanıt" };
    const parsed = z
      .object({
        ok: z.boolean(),
        suggested_index: z
          .number()
          .int()
          .min(0)
          .max(data.options.length - 1),
        note: z.string().max(1000),
      })
      .safeParse(JSON.parse(args));
    if (!parsed.success) {
      return {
        model: model.label,
        ok: null,
        suggested_index: null,
        note: "Model geçersiz veya eksik değerlendirme döndürdü",
      };
    }
    return {
      model: model.label,
      ok: parsed.data.ok,
      suggested_index: parsed.data.suggested_index,
      note: parsed.data.note.slice(0, 300),
    };
  } catch (error) {
    const note =
      error instanceof Error && error.name === "TimeoutError"
        ? "45 saniyede yanıt alınamadı (zaman aşımı)"
        : error instanceof Error
          ? `İstek hatası: ${error.message.slice(0, 160)}`
          : "Bilinmeyen istek hatası";
    return { model: model.label, ok: null, suggested_index: null, note };
  }
}

/** 6 modelli yapay zeka jürisi ile soru doğruluk kontrolü. */
export const verifyQuestionWithJury = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI anahtarı yapılandırılmamış");

    const verdicts = await Promise.all(JURY.map((m) => askModel(m, apiKey, data)));
    const agree = verdicts.filter((v) => v.ok === true).length;
    const disagree = verdicts.filter((v) => v.ok === false).length;
    const responded = agree + disagree;
    const unavailable = JURY.length - responded;

    const tally = new Map<number, number>();
    for (const v of verdicts) {
      const idx = v.ok === true ? data.correct_index : v.suggested_index;
      if (idx === null || idx === undefined) continue;
      tally.set(idx, (tally.get(idx) ?? 0) + 1);
    }
    let consensus: number | null = null;
    let best = 0;
    for (const [idx, n] of tally)
      if (n > best) {
        best = n;
        consensus = idx;
      }

    const summary =
      responded === 0
        ? `Hiçbir modelden yanıt alınamadı (0/${JURY.length}). Her modelin hata ayrıntısını kontrol edin.`
        : agree === JURY.length
          ? `Tüm modeller (${agree}/${JURY.length}) soruyu doğru buldu.`
          : `${agree}/${responded} yanıt veren model soruyu doğru buldu.${unavailable ? ` ${unavailable} model yanıt vermedi.` : ""} ${consensus !== null && consensus !== data.correct_index ? `Cevap için çoğunluk önerisi: ${String.fromCharCode(65 + consensus)}. ` : ""}Soruyu yöneticinin incelemesi önerilir.`;

    return { verdicts, agree, disagree, consensus_index: consensus, summary };
  });
