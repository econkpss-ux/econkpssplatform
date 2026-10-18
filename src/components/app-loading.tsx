import { Loader2 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";

export function AppLoading({
  label = "Yükleniyor, lütfen bekleyiniz…",
}: {
  label?: string;
}) {
  return (
    <main
      className="canvas-bg flex min-h-dvh items-center justify-center px-5"
      role="status"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-5">
        <BrandLogo size="lg" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          {label}
        </div>
      </div>
    </main>
  );
}
