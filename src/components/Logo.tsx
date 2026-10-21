/** Logo NEOTRADE : mot en capitales, trait vert qui traverse le N (comme sur neotradegroup.com). */
export function Logo({ className = "", tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={`inline-flex items-baseline font-semibold tracking-[0.06em] ${tone === "light" ? "text-white" : "text-brand-indigo"} ${className}`} aria-label="NEOTRADE" dir="ltr">
      <span aria-hidden className="relative">
        N
        <span className="absolute -left-[0.12em] -top-[0.22em] h-[1.5em] w-[0.1em] origin-top -rotate-[33deg] rounded-full bg-brand-green" />
      </span>
      <span aria-hidden>EOTRADE</span>
    </span>
  );
}
