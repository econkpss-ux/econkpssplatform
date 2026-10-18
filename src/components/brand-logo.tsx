export function BrandLogo({
  className = "",
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const logoHeight = size === "sm" ? "h-6" : size === "lg" ? "h-9" : "h-7";
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img
        src="/econkpss-wordmark.png"
        alt="EconKPSS"
        width={426}
        height={93}
        className={`${logoHeight} w-auto object-contain dark:hidden`}
      />
      <img
        src="/econkpss-wordmark-dark.png"
        alt="EconKPSS"
        width={426}
        height={93}
        className={`${logoHeight} hidden w-auto object-contain dark:block`}
      />
    </span>
  );
}
