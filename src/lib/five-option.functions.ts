import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        prompt: z.string().min(3).max(1200),
        options: z.array(z.string().max(300)).min(3).max(4),
        correct_index: z.number().int().min(0).max(3),
      }),
    )
    .min(1)
    .max(10),
});

export type FifthOptionProposal = {
  id: string;
  option: string | null;
  error?: string;
};

async function proposeOne(
  apiKey: string,
  item: z.infer<typeof inputSchema>["items"][number],
): Promise<FifthOptionProposal> {
  const letters = item.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n");
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content:
              "Sen Türkiye KPSS sınavı için ÖSYM tarzı soru yazarısın. Sana 4 şıklı bir soru verilir; soruyu 5 şıklı (A-B-C-D-E) yapmak için MANTIKLI ve KESİNLİKLE YANLIŞ tek bir yeni çeldirici şık üretirsin. Yeni şık mevcut şıklarla aynı olmamalı, doğru cevap olmamalı, aynı biçim ve uzunlukta olmalı. Sadece istenen JSON'u döndür.",
          },
          {
            role: "user",
            content: `Soru: ${item.prompt}\nMevcut şıklar:\n${letters}\nDoğru şık: ${String.fromCharCode(65 + item.correct_index)}\n\nBu soruya eklenecek 5. çeldirici şıkkı üret.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "new_option",
              description: "Yeni çeldirici şık",
              parameters: {
                type: "object",
                properties: { option: { type: "string" } },
                required: ["option"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "new_option" } },
      }),
    });
    if (!res.ok) return { id: item.id, option: null, error: `Yanıt alınamadı (${res.status})` };
    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) return { id: item.id, option: null, error: "Boş yanıt" };
    const value = String((JSON.parse(args) as { option?: string }).option ?? "").trim();
    if (!value) return { id: item.id, option: null, error: "Şık üretilemedi" };
    const clash = item.options.some((o) => o.trim().toLowerCase() === value.toLowerCase());
    if (clash) return { id: item.id, option: null, error: "Üretilen şık mevcut şıkla aynı" };
    return { id: item.id, option: value.slice(0, 200) };
  } catch {
    return { id: item.id, option: null, error: "Hata" };
  }
}

/**
 * 4 şıklı soruları 5 şıklı (A-E) hale getirmek için çeldirici önerir.
 * Hiçbir kayıt yazılmaz; öneriler yöneticinin onayına sunulur.
 */
export const proposeFifthOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<{ proposals: FifthOptionProposal[] }> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI anahtarı yapılandırılmamış");

    const proposals = await Promise.all(data.items.map((item) => proposeOne(apiKey, item)));
    return { proposals };
  });
