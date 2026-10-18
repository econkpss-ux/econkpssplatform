import { Flame, Sparkles, Trophy } from "lucide-react";

export function ComboMeter({ streak }: { streak: number }) {
  const milestone = streak >= 10 ? 10 : streak >= 5 ? 5 : streak >= 3 ? 3 : 0;
  const next = streak < 3 ? 3 : streak < 5 ? 5 : streak < 10 ? 10 : streak + 10 - (streak % 10);
  const Icon = milestone >= 10 ? Trophy : milestone >= 5 ? Sparkles : Flame;

  return (
    <div className="min-w-28" aria-live="polite" aria-label={`${streak} doğru seri`}>
      <div className="flex items-center gap-1.5 text-sm font-bold">
        <Icon className={`size-4 ${streak >= 3 ? "text-amber" : "text-muted-foreground"}`} />
        <span>{streak} seri</span>
        {milestone > 0 && <span className="text-xs text-primary">{milestone >= 10 ? "Efsane!" : milestone >= 5 ? "Harika!" : "İyi gidiyor!"}</span>}
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={streak} aria-valuemin={0} aria-valuemax={next}>
        <div className="h-full rounded-full bg-amber transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(100, (streak / next) * 100)}%` }} />
      </div>
    </div>
  );
}