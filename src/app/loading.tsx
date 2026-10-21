/** Squelette affiché pendant le chargement d'une page (réseau lent à quai). */
export default function Loading() {
  return (
    <div aria-busy="true" className="mx-auto max-w-2xl space-y-3 px-4 pt-20">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-brand-indigo/10 motion-reduce:animate-none" />
      ))}
    </div>
  );
}
