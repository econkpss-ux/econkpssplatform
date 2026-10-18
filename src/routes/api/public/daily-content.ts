import { createFileRoute } from "@tanstack/react-router";

type Generated = {
  flashcards: { topic: string; front: string; back: string }[];
  pairs: { topic: string; left_text: string; right_text: string }[];
  questions: {
    topic: string;
    prompt: string;
    options: string[];
    correct_index: number;
    explanation: string;
  }[];
};

const SYSTEM = `Sen Türkiye KPSS Genel Kültür/Genel Yetenek sınavına hazırlanan öğrenciler için içerik üreten uzman bir eğitmensin.
Üretilen tüm içerik Türkçe, doğru, sınav müfredatına uygun ve özgün olmalı.
Sadece istenen JSON'u döndür.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function generateForSubject(
  subjectName: string,
  apiKey: string,
  avoid: string[],
): Promise<Generated | null> {
  const avoidBlock = avoid.length
    ? `\nAşağıdaki içerikler platformda ZATEN var. Bunları veya çok benzerlerini KESİNLİKLE tekrar üretme, tamamen farklı konu ve sorular seç:\n- ${avoid.slice(0, 120).join("\n- ")}`
    : "";
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      temperature: 1,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `"${subjectName}" dersi için günlük çalışma paketi üret:
- 4 bilgi kartı (kısa ön yüz sorusu/kavram, net arka yüz cevabı)
- 4 eşleştirme çifti (sol: kavram/olay, sağ: karşılığı/tarihi)
- 3 çoktan seçmeli soru (tam 5 şık (A-E), doğru şık indeksi 0-4, kısa açıklama)
Her öğede konu (topic) alanı bulunsun, ör. "Osmanlı Kuruluş Dönemi".
İçerikler özgün ve birbirinden farklı olsun; her gün farklı alt konular seç.${avoidBlock}`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "save_content",
            description: "Üretilen KPSS içeriğini kaydet",
            parameters: {
              type: "object",
              properties: {
                flashcards: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      front: { type: "string" },
                      back: { type: "string" },
                    },
                    required: ["topic", "front", "back"],
                    additionalProperties: false,
                  },
                },
                pairs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      topic: { type: "string" },
                      left_text: { type: "string" },
                      right_text: { type: "string" },
                    },
                    required: ["topic", "left_text", "right_text"],
                    additionalProperties: false,
                  },
                },
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
                    },
                    required: ["topic", "prompt", "options", "correct_index", "explanation"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["flashcards", "pairs", "questions"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "save_content" } },
    }),
  });

  if (!res.ok) {
    console.error("AI gateway error", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return null;
  try {
    return JSON.parse(args) as Generated;
  } catch {
    return null;
  }
}

async function run(force = false) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return jsonResponse({ error: "AI anahtarı yapılandırılmamış" }, 500);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subjects, error: subjectsError } = await supabaseAdmin
    .from("subjects")
    .select("id, name, slug")
    .order("sort_order");
  if (subjectsError || !subjects?.length) {
    return jsonResponse({ error: "Ders bulunamadı" }, 500);
  }

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("pending_content")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfDay.toISOString());
  if (!force && (count ?? 0) > 0) {
    return jsonResponse({ skipped: true, reason: "Bugünün içeriği zaten kuyruğa eklendi" });
  }

  const batchId = crypto.randomUUID();
  const summary: { subject: string; flashcards: number; pairs: number; questions: number }[] = [];

  for (const subject of subjects) {
    const { data: existingCards } = await supabaseAdmin
      .from("flashcards")
      .select("front")
      .eq("subject_id", subject.id)
      .order("created_at", { ascending: false })
      .limit(80);
    const { data: existingQuestions } = await supabaseAdmin
      .from("questions")
      .select("prompt")
      .eq("subject_id", subject.id)
      .order("created_at", { ascending: false })
      .limit(60);
    const { data: pendingRows } = await supabaseAdmin
      .from("pending_content")
      .select("prompt")
      .eq("subject_id", subject.id)
      .eq("status", "pending");

    const existingSet = new Set(
      [
        ...(existingCards ?? []).map((c) => c.front),
        ...(existingQuestions ?? []).map((q) => q.prompt),
        ...(pendingRows ?? []).map((p) => p.prompt),
      ].map((t) => t.trim().toLowerCase()),
    );

    const generated = await generateForSubject(subject.name, apiKey, [...existingSet].slice(0, 150));
    if (!generated) continue;

    const isNew = (text: string) => {
      const key = text.trim().toLowerCase();
      if (existingSet.has(key)) return false;
      existingSet.add(key);
      return true;
    };

    const flashcards = (generated.flashcards ?? [])
      .filter((f) => f.front && f.back && isNew(f.front))
      .slice(0, 4)
      .map((f) => ({
        batch_id: batchId,
        subject_id: subject.id,
        kind: "flashcard",
        topic: f.topic ?? null,
        prompt: f.front.slice(0, 300),
        answer: f.back.slice(0, 600),
        difficulty: 2,
        status: "pending",
      }));

    const pairs = (generated.pairs ?? [])
      .filter((p) => p.left_text && p.right_text && isNew(p.left_text))
      .slice(0, 4)
      .map((p) => ({
        batch_id: batchId,
        subject_id: subject.id,
        kind: "match",
        topic: p.topic ?? null,
        prompt: p.left_text.slice(0, 200),
        answer: p.right_text.slice(0, 200),
        difficulty: 2,
        status: "pending",
      }));

    const questions = (generated.questions ?? [])
      .filter((q) => q.prompt && Array.isArray(q.options) && q.options.length === 5 && isNew(q.prompt))
      .slice(0, 3)
      .map((q, i) => ({
        batch_id: batchId,
        subject_id: subject.id,
        kind: "question",
        topic: q.topic ?? null,
        prompt: q.prompt.slice(0, 600),
        options: q.options.map((o) => String(o).slice(0, 200)),
        correct_index: Math.min(Math.max(Number(q.correct_index) || 0, 0), 4),
        explanation: (q.explanation ?? "").slice(0, 600),
        difficulty: i % 2 === 0 ? 3 : 2,
        status: "pending",
      }));

    const rows = [...flashcards, ...pairs, ...questions];
    if (rows.length) {
      const { error } = await supabaseAdmin.from("pending_content").insert(rows);
      if (error) console.error("pending insert error", error.message);
    }

    summary.push({
      subject: subject.name,
      flashcards: flashcards.length,
      pairs: pairs.length,
      questions: questions.length,
    });
  }

  const total = summary.reduce((acc, s) => acc + s.flashcards + s.pairs + s.questions, 0);
  if (total > 0) {
    await notifyAdmins(supabaseAdmin, {
      subject: "Yönetici onayı bekleyen yeni içerikler 🔔",
      body: `Yapay zeka ${total} yeni içerik hazırladı. Yönetim panelindeki "Onay Bekleyen" sekmesinden inceleyip yayınlayabilirsiniz.`,
    });
  }

  return jsonResponse({ ok: true, queued: total, batch_id: batchId, summary });
}


async function notifyAdmins(db: any, msg: { subject: string; body: string }) {
  const { data } = await db.from("user_roles").select("user_id").in("role", ["admin", "super_admin"]);
  const ids = [...new Set(((data ?? []) as { user_id: string }[]).map((r) => r.user_id))];
  if (ids.length) await db.from("user_messages").insert(ids.map((user_id) => ({ user_id, ...msg })));
}

export const Route = createFileRoute("/api/public/daily-content")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["DAILY_CONTENT_SECRET"];
        const provided = request.headers.get("x-cron-secret");
        if (!expected || provided !== expected) {
          return jsonResponse({ error: "forbidden" }, 403);
        }
        return run(new URL(request.url).searchParams.get("force") === "1");
      },
    },
  },
});
