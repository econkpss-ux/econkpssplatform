import { createFileRoute } from "@tanstack/react-router";

type GeneratedQuestion = {
  topic: string;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty?: string;
};

const SYSTEM = `Sen Türkiye KPSS Genel Kültür/Genel Yetenek sınavına hazırlanan öğrenciler için soru üreten uzman bir eğitmensin.
Sorular Türkçe, ÖSYM tarzında, bilgi olarak KESİNLİKLE doğru ve özgün olmalı.
Sorular ORTA-ZOR seviyede olmalı: ezber yerine yorum, karşılaştırma, öncüllü (I-II-III) ve "hangisi yanlıştır/değildir" kalıpları kullan; çeldiriciler güçlü olsun. Kolay soru üretme.
Her soru için zorluk seviyesi belirt: "orta" veya "zor".
Her sorunun tam 5 şıkkı (A-E) olmalı, doğru şık indeksi 0-4 arasında ve şıklar birbirine yakın/mantıklı çeldiriciler olmalı.
Emin olmadığın bilgiyi asla soru yapma. Sadece istenen JSON'u döndür.`;

function difficultyToInt(value?: string) {
  const v = (value ?? "").toLowerCase();
  if (v.startsWith("kolay")) return 1;
  if (v.startsWith("zor")) return 3;
  return 2;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function generate(subjectName: string, apiKey: string, avoid: string[], count: number) {
  const avoidBlock = avoid.length
    ? `\nPlatformda ZATEN bulunan sorular (bunları veya çok benzerlerini asla üretme):\n- ${avoid.slice(0, 150).join("\n- ")}`
    : "";
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 1,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `"${subjectName}" dersi için ${count} adet yeni, özgün çoktan seçmeli KPSS sorusu üret. Soruları zorluk olarak dengeli dağıt (yaklaşık üçte biri kolay, üçte biri orta, üçte biri zor). Her soruda konu (topic) ve difficulty ("kolay"/"orta"/"zor") alanı olsun ve kısa bir açıklama ekle.${avoidBlock}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_questions",
            description: "Üretilen soruları kaydet",
            parameters: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      prompt: { type: "string" },
                      options: { type: "array", items: { type: "string" } },
                      correct_index: { type: "number" },
                      explanation: { type: "string" },
                      difficulty: { type: "string", enum: ["kolay", "orta", "zor"] },
                    },
                    required: ["topic", "prompt", "options", "correct_index", "explanation", "difficulty"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_questions" } },
    }),
  });

  if (!res.ok) {
    console.error("AI gateway error", res.status, await res.text());
    return [];
  }
  const data = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return [];
  try {
    return ((JSON.parse(args) as { questions?: GeneratedQuestion[] }).questions ?? []).filter(
      (q) => q.prompt && Array.isArray(q.options) && q.options.length === 5,
    );
  } catch {
    return [];
  }
}

async function run() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return jsonResponse({ error: "AI anahtarı yapılandırılmamış" }, 500);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subjects } = await supabaseAdmin
    .from("subjects")
    .select("id, name")
    .order("sort_order");
  if (!subjects?.length) return jsonResponse({ error: "Ders bulunamadı" }, 500);

  // Saatlik 10 soru derslere dağıtılır (sırayla, saate göre kaydırılarak).
  const hour = new Date().getUTCHours();
  const total = 10;
  const plan = new Map<string, number>();
  for (let i = 0; i < total; i++) {
    const s = subjects[(hour + i) % subjects.length]!;
    plan.set(s.id, (plan.get(s.id) ?? 0) + 1);
  }

  const batchId = crypto.randomUUID();
  let queued = 0;
  const skipped: string[] = [];

  for (const [subjectId, count] of plan) {
    const subject = subjects.find((s) => s.id === subjectId)!;
    const { data: existing } = await supabaseAdmin
      .from("questions")
      .select("prompt")
      .eq("subject_id", subjectId)
      .order("created_at", { ascending: false })
      .limit(150);
    const { data: pendingRows } = await supabaseAdmin
      .from("pending_content")
      .select("prompt")
      .eq("subject_id", subjectId)
      .eq("status", "pending");

    const existingSet = new Set(
      [...(existing ?? []), ...(pendingRows ?? [])].map((r) => r.prompt.trim().toLowerCase()),
    );

    const generated = await generate(subject.name, apiKey, [...existingSet].slice(0, 150), count);
    const rows = generated
      .filter((q) => {
        const key = q.prompt.trim().toLowerCase();
        if (existingSet.has(key)) {
          skipped.push(q.prompt);
          return false;
        }
        existingSet.add(key);
        return true;
      })
      .slice(0, count)
      .map((q) => ({
        batch_id: batchId,
        subject_id: subjectId,
        kind: "question",
        topic: q.topic ?? null,
        prompt: q.prompt.slice(0, 600),
        options: q.options.map((o) => String(o).slice(0, 200)),
        correct_index: Math.min(Math.max(Number(q.correct_index) || 0, 0), 4),
        explanation: (q.explanation ?? "").slice(0, 600),
        difficulty: difficultyToInt(q.difficulty),
        status: "pending",
      }));

    if (rows.length) {
      const { error } = await supabaseAdmin.from("pending_content").insert(rows);
      if (error) console.error("pending insert error", error.message);
      else queued += rows.length;
    }
  }

  if (queued > 0) {
    await notifyAdmins(supabaseAdmin, {
      subject: "Yönetici onayı bekleyen yeni sorular 🔔",
      body: `Yapay zeka ${queued} yeni soru hazırladı. Yönetim panelindeki "Onay Bekleyen" sekmesinden inceleyip yayınlayabilirsiniz.`,
    });
  }

  return jsonResponse({ ok: true, queued, duplicates_skipped: skipped.length, batch_id: batchId });
}

async function notifyAdmins(db: any, msg: { subject: string; body: string }) {
  const { data } = await db.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  if (ids.length) await db.from("user_messages").insert(ids.map((user_id) => ({ user_id, ...msg })));
}

export const Route = createFileRoute("/api/public/hourly-questions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["DAILY_CONTENT_SECRET"];
        const provided = request.headers.get("x-cron-secret");
        if (!expected || provided !== expected) return jsonResponse({ error: "forbidden" }, 403);
        return run();
      },
    },
  },
});