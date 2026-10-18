import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession } from "@/lib/auth";
import { subjectsQuery } from "@/lib/econ";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldAlert, Users, Layers, ListChecks, Megaphone, Trash2, BookOpen, Shuffle, KeyRound, Ban, Mail, Check, Pencil } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import {
  adminSetPassword,
  adminBanUser,
  adminUnbanUser,
  adminDeleteUser,
  adminApproveUser,
  adminSendMessage,
  adminUpdateUser,
} from "@/lib/admin-users.functions";
import { ConfirmButton } from "@/components/confirm-button";
import { adminPushAnnouncement, adminTestPush } from "@/lib/admin-users.functions";
import { PendingQueue } from "@/components/admin/pending-queue";
import { ReportsPanel } from "@/components/admin/reports-panel";
import { QuestionBank } from "@/components/admin/question-bank";
import { FiveOptionTool } from "@/components/admin/five-option-tool";
import {
  EditFlashcardDialog,
  EditPairDialog,
  EditQuestionDialog,
  DuplicateWarningDialog,
} from "@/components/admin/edit-dialogs";
import { ActivityPanel } from "@/components/admin/activity-panel";
import { MaintenanceControl } from "@/components/admin/maintenance-control";
import { AccountDeletionQueue } from "@/components/admin/account-deletion-queue";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Yönetim Paneli — EconKPSS" },
      { name: "description", content: "İçerik, kullanıcı ve duyuru yönetimi." },
      { property: "og:title", content: "Yönetim Paneli — EconKPSS" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:description", content: "EconKPSS platform yönetimi." },
    ],
  }),
  component: AdminPage,
});

const cardSchema = z.object({
  subject_id: z.string().uuid(),
  topic: z.string().trim().max(80).nullable(),
  front: z.string().trim().min(3).max(300),
  back: z.string().trim().min(1).max(600),
});

const questionSchema = z.object({
  subject_id: z.string().uuid(),
  topic: z.string().trim().max(80).nullable(),
  prompt: z.string().trim().min(5).max(600),
  options: z.array(z.string().trim().min(1).max(200)).length(5),
  correct_index: z.number().min(0).max(4),
  explanation: z.string().trim().max(600),
});

const subjectSchema = z.object({
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).nullable(),
  color: z.string().trim().min(2).max(20),
  sort_order: z.number().min(0).max(99),
});

const pairSchema = z.object({
  subject_id: z.string().uuid(),
  topic: z.string().trim().max(80).nullable(),
  left_text: z.string().trim().min(1).max(200),
  right_text: z.string().trim().min(1).max(200),
});

const announcementSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(800),
});

function AdminPage() {
  const { user } = useSession();
  const { isAdmin, isSuperAdmin, loading } = useRoles(user);

  if (loading) return <p className="text-muted-foreground">Yükleniyor…</p>;

  if (!isAdmin) {
    return (
      <div className="bento flex flex-col items-center gap-3 p-12 text-center">
        <ShieldAlert className="size-8 text-destructive" />
        <h1 className="text-xl font-bold">Bu alana erişim yetkin yok</h1>
        <p className="text-muted-foreground">Yönetim paneli sadece yöneticiler içindir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Yönetim Paneli</h1>
        <p className="mt-1 text-muted-foreground">
          {isSuperAdmin ? "Kurucu yönetici yetkileri aktif." : "Yönetici yetkileri aktif."}
        </p>
      </header>

      <Tabs defaultValue="pending">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg p-1 sm:grid-cols-5 [&>button]:min-h-10 [&>button]:min-w-0 [&>button]:whitespace-normal [&>button]:px-2 [&>button]:text-xs sm:[&>button]:text-sm">
          <TabsTrigger value="pending">Onay Bekleyen</TabsTrigger>
          <TabsTrigger value="reports">Bildirimler</TabsTrigger>
          <TabsTrigger value="subjects">Dersler</TabsTrigger>
          <TabsTrigger value="bank">Soru Bankası</TabsTrigger>
          <TabsTrigger value="five">5 Şık (A–E)</TabsTrigger>
          <TabsTrigger value="content">İçerik</TabsTrigger>
          <TabsTrigger value="announcements">Duyurular</TabsTrigger>
          <TabsTrigger value="account-deletions">Hesap Silme</TabsTrigger>
          <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="activity">Aktiviteler</TabsTrigger>
          <TabsTrigger value="maintenance">Bakım Modu</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4">
          <PendingQueue />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsPanel />
        </TabsContent>
        <TabsContent value="subjects" className="mt-4">
          <SubjectAdmin />
        </TabsContent>
        <TabsContent value="bank" className="mt-4">
          <QuestionBank />
        </TabsContent>
        <TabsContent value="five" className="mt-4">
          <FiveOptionTool />
        </TabsContent>
        <TabsContent value="content" className="mt-4 space-y-4">
          <FlashcardAdmin />
          <QuestionAdmin />
          <MatchPairAdmin />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <AnnouncementAdmin />
        </TabsContent>
        <TabsContent value="account-deletions" className="mt-4">
          <AccountDeletionQueue />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <UsersAdmin isSuperAdmin={isSuperAdmin} />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityPanel />
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <MaintenanceControl />
        </TabsContent>
      </Tabs>

    </div>
  );
}

function useSubjects() {
  return useQuery(subjectsQuery);
}

function FlashcardAdmin() {
  const qc = useQueryClient();
  const { data: subjects } = useSubjects();
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  const [dup, setDup] = useState<{ open: boolean; preview: string }>({ open: false, preview: "" });

  const { data: cards } = useQuery({
    queryKey: ["admin-flashcards"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, front, back, subject_id, topic")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  async function insertCard() {
    const parsed = cardSchema.safeParse({ subject_id: subjectId, topic: topic.trim() || null, front, back });
    if (!parsed.success) { toast.error("Lütfen tüm alanları geçerli şekilde doldur."); return; }
    const { error } = await supabase.from("flashcards").insert(parsed.data);
    if (error) { toast.error(error.message); return; }
    toast.success("Kart eklendi");
    setFront("");
    setBack("");
    qc.invalidateQueries({ queryKey: ["admin-flashcards"] });
    qc.invalidateQueries({ queryKey: ["flashcards"] });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = cardSchema.safeParse({ subject_id: subjectId, topic: topic.trim() || null, front, back });
    if (!parsed.success) { toast.error("Lütfen tüm alanları geçerli şekilde doldur."); return; }
    const { data: existing } = await supabase
      .from("flashcards")
      .select("front")
      .eq("front", front.trim())
      .limit(1);
    if (existing?.length) {
      setDup({ open: true, preview: existing[0]!.front });
      return;
    }
    await insertCard();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("flashcards").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Kart silindi");
    qc.invalidateQueries({ queryKey: ["admin-flashcards"] });
  }

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Layers className="size-4 text-primary" /> Bilgi Kartları
      </h2>
      <form onSubmit={add} className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label>Ders</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">Seç…</option>
            {(subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Ön yüz</Label>
          <Input value={front} onChange={(e) => setFront(e.target.value)} maxLength={300} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Konu (opsiyonel)</Label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            maxLength={80}
            placeholder="ör. Osmanlı Kuruluş"
          />
        </div>
        <div className="space-y-2">
          <Label>Arka yüz</Label>
          <Input value={back} onChange={(e) => setBack(e.target.value)} maxLength={600} />
        </div>
        <Button type="submit" className="md:col-span-2">
          Kart ekle
        </Button>
      </form>

      <ul className="mt-5 space-y-2">
        {(cards ?? []).map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm"
          >
            <span className="truncate">
              {c.topic ? <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">{c.topic}</span> : null}
              {c.front}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <EditFlashcardDialog card={c} />
              <ConfirmButton
                description="Bu bilgi kartı kalıcı olarak silinecek."
                onConfirm={() => remove(c.id)}
                trigger={
                  <Button variant="ghost" size="icon">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                }
              />
            </span>
          </li>
        ))}
      </ul>
      <DuplicateWarningDialog
        open={dup.open}
        onOpenChange={(o) => setDup((d) => ({ ...d, open: o }))}
        preview={dup.preview}
        onConfirm={() => {
          setDup({ open: false, preview: "" });
          void insertCard();
        }}
      />

    </section>
  );
}

function QuestionAdmin() {
  const qc = useQueryClient();
  const { data: subjects } = useSubjects();
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", "", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [dup, setDup] = useState<{ open: boolean; preview: string }>({ open: false, preview: "" });

  const { data: questions } = useQuery({
    queryKey: ["admin-questions"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("questions")
        .select("id, prompt")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  function parseForm() {
    return questionSchema.safeParse({
      subject_id: subjectId,
      topic: topic.trim() || null,
      prompt,
      options,
      correct_index: correct,
      explanation,
    });
  }

  async function insertQuestion() {
    const parsed = parseForm();
    if (!parsed.success) { toast.error("Soru, 5 şık ve ders zorunludur."); return; }
    const { error } = await supabase.from("questions").insert(parsed.data);
    if (error) { toast.error(error.message); return; }
    toast.success("Soru eklendi");
    setPrompt("");
    setOptions(["", "", "", "", ""]);
    setExplanation("");
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
    qc.invalidateQueries({ queryKey: ["admin-question-bank"] });
    qc.invalidateQueries({ queryKey: ["questions"] });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseForm();
    if (!parsed.success) { toast.error("Soru, 5 şık ve ders zorunludur."); return; }
    const { data: existing } = await supabase
      .from("questions")
      .select("prompt")
      .eq("prompt", prompt.trim())
      .limit(1);
    if (existing?.length) {
      setDup({ open: true, preview: existing[0]!.prompt });
      return;
    }
    await insertQuestion();
  }


  async function remove(id: string) {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-questions"] });
  }

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ListChecks className="size-4 text-primary" /> Sorular
      </h2>
      <form onSubmit={add} className="mt-4 space-y-3">
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="">Ders seç…</option>
          {(subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Konu (opsiyonel) — ör. İnkılaplar"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={80}
        />
        <Textarea
          placeholder="Soru metni"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={600}
        />
        <div className="grid gap-2 md:grid-cols-2">
          {options.map((o, i) => (
            <label key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={correct === i}
                onChange={() => setCorrect(i)}
              />
              <Input
                placeholder={`Şık ${i + 1}`}
                value={o}
                maxLength={200}
                onChange={(e) =>
                  setOptions((prev) => prev.map((p, idx) => (idx === i ? e.target.value : p)))
                }
              />
            </label>
          ))}
        </div>
        <Textarea
          placeholder="Açıklama"
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          maxLength={600}
        />
        <Button type="submit">Soru ekle</Button>
      </form>

      <ul className="mt-5 space-y-2">
        {(questions ?? []).map((q) => (
          <li
            key={q.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm"
          >
            <span className="truncate">{q.prompt}</span>
            <span className="flex shrink-0 items-center gap-1">
              <EditQuestionDialog questionId={q.id} />
              <ConfirmButton
                description="Bu soru kalıcı olarak silinecek."
                onConfirm={() => remove(q.id)}
                trigger={
                  <Button variant="ghost" size="icon">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                }
              />
            </span>
          </li>
        ))}
      </ul>
      <DuplicateWarningDialog
        open={dup.open}
        onOpenChange={(o) => setDup((d) => ({ ...d, open: o }))}
        preview={dup.preview}
        onConfirm={() => {
          setDup({ open: false, preview: "" });
          void insertQuestion();
        }}
      />

    </section>
  );
}

function AnnouncementAdmin() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const pushAnnouncement = useServerFn(adminPushAnnouncement);
  const testPush = useServerFn(adminTestPush);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = announcementSchema.safeParse({ title, body });
    if (!parsed.success) { toast.error("Başlık ve içerik gerekli."); return; }
    const { error } = await supabase.from("announcements").insert(parsed.data);
    if (error) { toast.error(error.message); return; }
    try {
      const r = await pushAnnouncement({ data: parsed.data });
      if (r.reason === "not-configured") {
        toast.error(
          `Duyuru yayınlandı ancak sunucu ayarları eksik: ${r.missingConfig?.join(", ") ?? "Firebase gönderim ayarları"}.`,
        );
      } else if (r.reason === "no-registered-devices") {
        toast.error("Duyuru yayınlandı ancak bildirim almayı açmış kayıtlı cihaz bulunamadı.");
      } else if (r.failed > 0) {
        toast.warning(`Duyuru yayınlandı · ${r.sent} cihaza gönderildi, ${r.failed} gönderim başarısız oldu.`);
      } else {
        toast.success(`Duyuru yayınlandı · ${r.sent} cihaza bildirim gönderildi.`);
      }
    } catch (error) {
      console.error("Announcement push failed:", error);
      toast.error("Duyuru kaydedildi ancak bildirim gönderilemedi. Sunucu günlüklerini kontrol edin.");
    }
    setTitle("");
    setBody("");
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["announcements"] });
  }

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Megaphone className="size-4 text-primary" /> Duyurular
      </h2>
      <form onSubmit={add} className="mt-4 space-y-3">
        <Input
          placeholder="Başlık"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
        <Textarea
          placeholder="İçerik"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={800}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit">Yayınla ve bildirim gönder</Button>
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                const r = await testPush();
                if (r.reason === "not-configured")
                  toast.error(
                    `Sunucu ayarları eksik: ${r.missingConfig?.join(", ") ?? "Firebase gönderim ayarları"}.`,
                  );
                else if (r.reason === "no-registered-devices") toast.error("Bu hesapta kayıtlı bildirim cihazı yok. Önce zile basıp izni aç.");
                else if (r.sent > 0) toast.success(`${r.sent} cihazına deneme bildirimi gönderildi.`);
                else toast.error(`Deneme bildirimi gönderilemedi (${r.failed} başarısız gönderim).`);
              } catch (error) {
                console.error("Test push failed:", error);
                toast.error("Deneme bildirimi gönderilemedi. Sunucu günlüklerini kontrol edin.");
              }
            }}
          >
            Kendime deneme bildirimi
          </Button>
        </div>
      </form>
      <ul className="mt-5 space-y-2">
        {(data ?? []).map((a) => (
          <li key={a.id} className="flex items-start justify-between gap-3 rounded-lg bg-secondary p-3">
            <span>
              <span className="block font-semibold">{a.title}</span>
              <span className="text-sm text-muted-foreground">{a.body}</span>
            </span>
            <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UsersAdmin({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const qc = useQueryClient();
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [banFor, setBanFor] = useState<string | null>(null);
  const [banDays, setBanDays] = useState(7);
  const [banReason, setBanReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [messageFor, setMessageFor] = useState<string | null>(null);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [editFor, setEditFor] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const updateUser = useServerFn(adminUpdateUser);

  const setPassword = useServerFn(adminSetPassword);
  const banUser = useServerFn(adminBanUser);
  const unbanUser = useServerFn(adminUnbanUser);
  const deleteUser = useServerFn(adminDeleteUser);
  const approveUser = useServerFn(adminApproveUser);
  const sendMessage = useServerFn(adminSendMessage);

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, points, created_at, banned_until, ban_reason, approved")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data;
    },
  });

  async function run(fn: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(okMessage);
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["membership-profile"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız oldu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Users className="size-4 text-primary" /> Kullanıcılar ({profiles?.length ?? 0})
      </h2>
      {!isSuperAdmin && (
        <p className="mt-2 text-sm text-muted-foreground">
          Rol değişiklikleri yalnızca kurucu yönetici tarafından yapılabilir.
        </p>
      )}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm [&_td]:pr-3 [&_th]:pr-3">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-2">Ad</th>
              <th className="py-2">E-posta</th>
              <th className="py-2">Puan</th>
              <th className="py-2">Roller</th>
              <th className="py-2">Durum</th>
              <th className="py-2">Üyelik</th>
              <th className="py-2">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const banned = p.banned_until && new Date(p.banned_until) > new Date();
              return (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="py-2 font-medium">{p.full_name ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{p.email}</td>
                  <td className="py-2">{p.points}</td>
                  <td className="py-2">
                    {(roles ?? [])
                      .filter((r) => r.user_id === p.id)
                      .map((r) => r.role)
                      .join(", ") || "student"}
                  </td>
                  <td className="py-2">
                    {banned ? (
                      <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
                        Cezalı · {p.banned_until ? new Date(p.banned_until).toLocaleDateString("tr-TR") : ""}
                        {p.ban_reason ? ` · ${p.ban_reason}` : ""}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Aktif</span>
                    )}
                  </td>
                  <td className="py-2">
                    {p.approved ? (
                      <span className="text-xs font-medium text-mint">Onaylı</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" disabled={busy} onClick={() => void run(() => approveUser({ data: { userId: p.id } }), "Üyelik onaylandı")}>
                          <Check className="size-3" /> Onayla
                        </Button>
                        <ConfirmButton
                          trigger={<Button size="sm" variant="outline" disabled={busy}>Reddet</Button>}
                          title="Üyelik reddedilsin mi?"
                          description="Bekleyen üyelik ve hesabına bağlı veriler kalıcı olarak silinecek. Bu işlem geri alınamaz."
                          confirmLabel="Evet, reddet"
                          onConfirm={() => run(() => deleteUser({ data: { userId: p.id } }), "Üyelik reddedildi")}
                        />
                      </div>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                        setEditFor(editFor === p.id ? null : p.id);
                        setEditName(p.full_name ?? "");
                        setEditEmail(p.email ?? "");
                      }}><Pencil className="size-3" /> Düzenle</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                        setMessageFor(messageFor === p.id ? null : p.id);
                        setMessageSubject("");
                        setMessageBody("");
                      }}><Mail className="size-3" /> Mesaj</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          setPwFor(pwFor === p.id ? null : p.id);
                          setPw("");
                        }}
                      >
                        <KeyRound className="size-3" /> Şifre
                      </Button>
                      {banned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => run(() => unbanUser({ data: { userId: p.id } }), "Ceza kaldırıldı")}
                        >
                          Cezayı kaldır
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => {
                            setBanFor(banFor === p.id ? null : p.id);
                            setBanReason("");
                          }}
                        >
                          <Ban className="size-3" /> Ceza ver
                        </Button>
                      )}
                      <ConfirmButton
                        trigger={
                          <Button size="sm" variant="destructive" disabled={busy}>
                            <Trash2 className="size-3" />
                          </Button>
                        }
                        title="Hesap kalıcı olarak silinsin mi?"
                        description={`${p.email ?? "Bu kullanıcı"} hesabı ve tüm ilerlemesi kalıcı olarak silinecek. Bu işlem geri alınamaz.`}
                        confirmLabel="Evet, hesabı sil"
                        onConfirm={() => run(() => deleteUser({ data: { userId: p.id } }), "Hesap silindi")}
                      />
                    </div>
                    {editFor === p.id && (
                      <form className="mt-3 min-w-56 space-y-2" onSubmit={(e) => {
                        e.preventDefault();
                        void run(async () => {
                          await updateUser({ data: { userId: p.id, fullName: editName, email: editEmail } });
                          setEditFor(null);
                        }, "Ad-soyad ve e-posta güncellendi");
                      }}>
                        <Label htmlFor={`edit-name-${p.id}`}>Ad Soyad</Label>
                        <Input id={`edit-name-${p.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} minLength={2} maxLength={80} required />
                        <Label htmlFor={`edit-email-${p.id}`}>E-posta</Label>
                        <Input id={`edit-email-${p.id}`} type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} maxLength={255} required />
                        <div className="flex gap-2">
                          <Button size="sm" type="submit" disabled={busy}>Kaydet</Button>
                          <Button size="sm" type="button" variant="outline" onClick={() => setEditFor(null)}>Vazgeç</Button>
                        </div>
                      </form>
                    )}
                    {messageFor === p.id && (
                      <div className="mt-2 min-w-56 space-y-2">
                        <Input aria-label="Mesaj konusu" placeholder="Konu" value={messageSubject} maxLength={120} onChange={(e) => setMessageSubject(e.target.value)} />
                        <Textarea aria-label="Mesaj metni" placeholder="Kişisel mesaj" value={messageBody} maxLength={2000} onChange={(e) => setMessageBody(e.target.value)} />
                        <Button size="sm" disabled={busy || messageSubject.trim().length < 3 || messageBody.trim().length < 3} onClick={() => void run(async () => {
                          await sendMessage({ data: { userId: p.id, subject: messageSubject.trim(), body: messageBody.trim() } });
                          setMessageFor(null);
                          setMessageSubject("");
                          setMessageBody("");
                        }, "Mesaj gönderildi")}>Gönder</Button>
                      </div>
                    )}
                    {pwFor === p.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Input
                          className="h-8 w-52"
                          value={pw}
                          onChange={(e) => setPw(e.target.value)}
                          placeholder="Yeni aktivasyon şifresi (min 8)"
                        />
                        <Button
                          size="sm"
                          disabled={busy || pw.length < 8}
                          onClick={() =>
                            run(async () => {
                              await setPassword({ data: { userId: p.id, password: pw } });
                              setPwFor(null);
                              setPw("");
                            }, "Yeni şifre tanımlandı. Kullanıcıya e-posta ile iletebilirsiniz.")
                          }
                        >
                          Tanımla
                        </Button>
                      </div>
                    )}
                    {banFor === p.id && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Input
                          className="h-8 w-20"
                          type="number"
                          min={1}
                          value={banDays}
                          onChange={(e) => setBanDays(Number(e.target.value))}
                        />
                        <span className="text-xs text-muted-foreground">gün</span>
                        <Input
                          className="h-8 w-52"
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                          placeholder="Ceza nedeni"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busy || banDays < 1}
                          onClick={() =>
                            run(async () => {
                              await banUser({
                                data: { userId: p.id, days: banDays, reason: banReason },
                              });
                              setBanFor(null);
                            }, "Kullanıcıya ceza verildi")
                          }
                        >
                          Cezayı uygula
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
function SubjectAdmin() {
  const qc = useQueryClient();
  const { data: subjects } = useSubjects();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("blue");
  const [sortOrder, setSortOrder] = useState(0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = subjectSchema.safeParse({
      slug: slug.trim().toLowerCase(),
      name,
      description: description.trim() || null,
      color,
      sort_order: Number(sortOrder),
    });
    if (!parsed.success) {
      toast.error("Ders adı ve kısa ad (yalnızca küçük harf/tire) zorunludur.");
      return;
    }
    const { error } = await supabase.from("subjects").insert(parsed.data);
    if (error) { toast.error(error.message); return; }
    toast.success("Ders eklendi");
    setSlug("");
    setName("");
    setDescription("");
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("subjects").delete().eq("id", id);
    if (error) { toast.error("Bu derse bağlı içerikler olduğu için silinemedi."); return; }
    qc.invalidateQueries({ queryKey: ["subjects"] });
  }

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <BookOpen className="size-4 text-primary" /> Dersler
      </h2>
      <form onSubmit={add} className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Ders adı</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-2">
          <Label>Kısa ad (slug)</Label>
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={40}
            placeholder="tarih"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Açıklama</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label>Renk</Label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          >
            {["blue", "emerald", "amber", "violet", "rose"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label>Sıra</Label>
          <Input
            type="number"
            min={0}
            max={99}
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
          />
        </div>
        <Button type="submit" className="md:col-span-2">
          Ders ekle
        </Button>
      </form>

      <ul className="mt-5 space-y-2">
        {(subjects ?? []).map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm"
          >
            <span className="truncate">
              <span className="font-semibold">{s.name}</span>{" "}
              <span className="text-muted-foreground">/{s.slug}</span>
            </span>
            <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MatchPairAdmin() {
  const qc = useQueryClient();
  const { data: subjects } = useSubjects();
  const [subjectId, setSubjectId] = useState("");
  const [topic, setTopic] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [dup, setDup] = useState<{ open: boolean; preview: string }>({ open: false, preview: "" });
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");

  const { data: pairs } = useQuery({
    queryKey: ["admin-pairs"],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const all: { id: string; left_text: string; right_text: string; topic: string | null; subject_id: string }[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase
          .from("match_pairs")
          .select("id, left_text, right_text, topic, subject_id")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 999);
        if (error) throw error;
        all.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return all;
    },
  });
  const filteredPairs = (pairs ?? []).filter((p) =>
    (!filterSubject || p.subject_id === filterSubject) &&
    (!search.trim() || `${p.left_text} ${p.right_text} ${p.topic ?? ""}`.toLocaleLowerCase("tr-TR").includes(search.trim().toLocaleLowerCase("tr-TR"))),
  );

  function parseForm() {
    return pairSchema.safeParse({
      subject_id: subjectId,
      topic: topic.trim() || null,
      left_text: left,
      right_text: right,
    });
  }

  async function insertPair() {
    const parsed = parseForm();
    if (!parsed.success) { toast.error("Ders ve iki eşleşme metni zorunludur."); return; }
    const { error } = await supabase.from("match_pairs").insert(parsed.data);
    if (error) { toast.error(error.message); return; }
    toast.success("Eşleştirme eklendi");
    setLeft("");
    setRight("");
    qc.invalidateQueries({ queryKey: ["admin-pairs"] });
    qc.invalidateQueries({ queryKey: ["match-pairs"] });
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseForm();
    if (!parsed.success) { toast.error("Ders ve iki eşleşme metni zorunludur."); return; }
    const { data: existing } = await supabase
      .from("match_pairs")
      .select("left_text")
      .eq("left_text", left.trim())
      .limit(1);
    if (existing?.length) {
      setDup({ open: true, preview: existing[0]!.left_text });
      return;
    }
    await insertPair();
  }


  async function remove(id: string) {
    const { error } = await supabase.from("match_pairs").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-pairs"] });
  }

  return (
    <section className="bento p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Shuffle className="size-4 text-primary" /> Eşleştirme Çiftleri
      </h2>
      <form onSubmit={add} className="mt-4 grid gap-3 md:grid-cols-2">
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm md:col-span-2"
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
        >
          <option value="">Ders seç…</option>
          {(subjects ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <Input
          className="md:col-span-2"
          placeholder="Konu (opsiyonel)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={80}
        />
        <Input placeholder="Sol taraf" value={left} onChange={(e) => setLeft(e.target.value)} maxLength={200} />
        <Input placeholder="Sağ taraf" value={right} onChange={(e) => setRight(e.target.value)} maxLength={200} />
        <Button type="submit" className="md:col-span-2">
          Eşleştirme ekle
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap gap-2">
        <Input className="min-w-48 flex-1" aria-label="Eşleştirmelerde ara" placeholder="Eşleştirmelerde ara" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Eşleştirmeleri derse göre filtrele" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">Tüm dersler</option>
          {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{filteredPairs.length} / {pairs?.length ?? 0} eşleştirme</p>
      <ul className="mt-3 max-h-[36rem] space-y-2 overflow-y-auto">
        {filteredPairs.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-3 py-2 text-sm"
          >
            <span className="min-w-0 break-words">
              <span className="mr-2 text-xs text-muted-foreground">{subjects?.find((s) => s.id === p.subject_id)?.name ?? "Ders"}</span>
              {p.topic ? (
                <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                  {p.topic}
                </span>
              ) : null}
              {p.left_text} → {p.right_text}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <EditPairDialog pair={p} />
              <ConfirmButton
                description="Bu eşleştirme kalıcı olarak silinecek."
                onConfirm={() => remove(p.id)}
                trigger={
                  <Button variant="ghost" size="icon">
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                }
              />
            </span>

          </li>
        ))}
      </ul>
      <DuplicateWarningDialog
        open={dup.open}
        onOpenChange={(o) => setDup((d) => ({ ...d, open: o }))}
        preview={dup.preview}
        onConfirm={() => {
          setDup({ open: false, preview: "" });
          void insertPair();
        }}
      />

    </section>
  );
}
