import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowRight, BookOpenCheck, Clock3, RotateCcw, Sparkles, Target } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { Subject } from "@/lib/econ";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type ProgressEvent = Pick<
  Database["public"]["Tables"]["progress_events"]["Row"],
  "content_id" | "created_at" | "id" | "is_correct" | "kind" | "points" | "subject_id" | "topic"
>;

type TopicPerformance = {
  subjectId: string;
  subject: string;
  topic: string;
  attempts: number;
  correct: number;
  lastStudied: number;
};

type StudyTask = {
  id: string;
  title: string;
  description: string;
  subjectId?: string;
  topic?: string;
  goal: number;
  minutes: number;
  icon: typeof Target;
  trackProgress?: boolean;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function localDayOrdinal(date: Date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

function completedQuestions(task: StudyTask, questions: ProgressEvent[]) {
  return Math.min(
    task.goal,
    questions.filter(
      (event) =>
        (!task.subjectId || event.subject_id === task.subjectId) &&
        (!task.topic || event.topic === task.topic),
    ).length,
  );
}

export function StudyCoach({
  events,
  subjects,
  isLoading,
  isError,
  onRetry,
}: {
  events: ProgressEvent[] | undefined;
  subjects: Subject[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const today = new Date();
  const todayKey = localDayKey(today);
  const todayOrdinal = localDayOrdinal(today);
  const subjectNames = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects],
  );

  const { tasks, todaysQuestions } = useMemo(() => {
    const progressEvents = events ?? [];
    const topicMap = new Map<string, TopicPerformance>();
    const todaysQuestions = progressEvents.filter(
      (event) =>
        event.kind === "question" &&
        event.is_correct !== null &&
        localDayKey(new Date(event.created_at)) === todayKey,
    );

    for (const event of progressEvents) {
      if (
        event.kind !== "question" ||
        event.is_correct === null ||
        !event.subject_id ||
        !event.topic?.trim() ||
        localDayKey(new Date(event.created_at)) === todayKey
      ) {
        continue;
      }

      const key = `${event.subject_id}|${event.topic}`;
      const topic = topicMap.get(key) ?? {
        subjectId: event.subject_id,
        subject: subjectNames.get(event.subject_id) ?? "Ders",
        topic: event.topic,
        attempts: 0,
        correct: 0,
        lastStudied: 0,
      };
      topic.attempts += 1;
      if (event.is_correct) topic.correct += 1;
      topic.lastStudied = Math.max(topic.lastStudied, new Date(event.created_at).getTime());
      topicMap.set(key, topic);
    }

    const performances = [...topicMap.values()].map((topic) => {
      const accuracy = (topic.correct / topic.attempts) * 100;
      const daysSinceStudy = Math.floor(
        todayOrdinal - localDayOrdinal(new Date(topic.lastStudied)),
      );
      const reviewInterval = accuracy < 50 ? 1 : accuracy < 75 ? 3 : accuracy < 90 ? 7 : 14;
      const priority =
        (100 - accuracy) * 0.7 +
        Math.max(0, 5 - topic.attempts) * 4 +
        (daysSinceStudy >= reviewInterval ? 8 : 0);
      return {
        ...topic,
        accuracy,
        daysSinceStudy,
        reviewInterval,
        priority,
        daysOverdue: daysSinceStudy - reviewInterval,
      };
    });

    const byPriority = [...performances].sort((a, b) => b.priority - a.priority);
    const primary = byPriority[0];
    const review = performances
      .filter((topic) => topic !== primary && topic.daysOverdue >= 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue || a.accuracy - b.accuracy)[0];
    const secondary = review ?? byPriority.find((topic) => topic !== primary);

    const tasks: StudyTask[] = [];
    if (primary) {
      tasks.push({
        id: "focus",
        title: "Öncelikli çalışma konusu",
        description: `${primary.subject} · ${primary.topic} · son doğruluk %${Math.round(primary.accuracy)}`,
        subjectId: primary.subjectId,
        topic: primary.topic,
        goal: 5,
        minutes: 12,
        icon: Target,
      });
    } else {
      tasks.push({
        id: "diagnostic",
        title: "Başlangıç seviye turu",
        description: "5 soruluk kısa turla çalışma geçmişini oluşturmaya başla.",
        goal: 5,
        minutes: 10,
        icon: Sparkles,
      });
    }

    if (secondary) {
      tasks.push({
        id: review ? "spaced-review" : "reinforce",
        title: review ? "Aralıklı tekrar zamanı" : "İkinci konuyu pekiştir",
        description: `${secondary.subject} · ${secondary.topic}${
          review ? ` · ${secondary.daysSinceStudy} gündür tekrar edilmedi` : ""
        }`,
        subjectId: secondary.subjectId,
        topic: secondary.topic,
        goal: 5,
        minutes: 12,
        icon: RotateCcw,
      });
    }

    tasks.push({
      id: "mixed",
      title: "Karma soru turu",
      description: "Farklı derslerden çözerek bilgini sınav temposunda tazele.",
      goal: 10,
      minutes: 15,
      icon: BookOpenCheck,
      trackProgress: false,
    });

    return { tasks, todaysQuestions };
  }, [events, subjectNames, todayKey, todayOrdinal]);

  if (isError && !events) {
    return (
      <section className="bento flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="flex items-center gap-2 font-bold">
            <Sparkles className="size-5 text-primary" />
            Akıllı çalışma koçun
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Çalışma geçmişin alınamadı. Önerileri oluşturmak için tekrar dene.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Tekrar dene
        </Button>
      </section>
    );
  }

  if (isLoading && !events) {
    return (
      <section className="bento p-6">
        <h2 className="flex items-center gap-2 font-bold">
          <Sparkles className="size-5 text-primary" />
          Akıllı çalışma koçun
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Çalışma planın hazırlanıyor…</p>
      </section>
    );
  }

  return (
    <section className="bento overflow-hidden p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Sparkles className="size-5 text-primary" />
            Akıllı çalışma koçun
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Geçmiş cevaplarına göre hazırlandı; bugünkü çözümlerin anlık sayılır.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          Bugün {todaysQuestions.length} soru çözdün
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {tasks.map((task) => {
          const Icon = task.icon;
          const done = completedQuestions(task, todaysQuestions);
          const isComplete = done >= task.goal;

          return (
            <Link
              key={task.id}
              to="/sorular"
              search={{
                subjectId: task.subjectId,
                topic: task.topic,
              }}
              className="group rounded-xl border border-border/70 bg-secondary/50 p-4 transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {task.minutes} dk
                </span>
              </div>
              <h3 className="mt-3 font-semibold">{task.title}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{task.description}</p>
              {task.trackProgress !== false && (
                <Progress value={(done / task.goal) * 100} className="mt-3 h-1.5" />
              )}
              <span className="mt-2 flex items-center justify-between text-xs font-medium">
                <span className={isComplete ? "text-primary" : "text-muted-foreground"}>
                  {task.trackProgress === false
                    ? `${task.goal} soruluk tur`
                    : isComplete
                      ? "Tamamlandı"
                      : `${done}/${task.goal} soru`}
                </span>
                <span className="inline-flex items-center gap-1 text-primary">
                  Başla
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
