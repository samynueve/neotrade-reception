/** Fuseau du quai : toutes les heures saisies sont des heures de Douvrin. */
export const TIME_ZONE = "Europe/Paris";

/** Décalage (ms) du fuseau de Paris par rapport à UTC à un instant donné. */
function parisOffsetMs(at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Convertit la valeur d'un champ datetime-local (« 2026-10-20T08:30 », heure de Paris) en Date. */
export function parseParisLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const naiveUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Deux passes pour tomber juste autour des changements d'heure
  let t = naiveUtc - parisOffsetMs(new Date(naiveUtc));
  t = naiveUtc - parisOffsetMs(new Date(t));
  return new Date(t);
}

/** Valeur pour un champ datetime-local, en heure de Paris. */
export function toParisLocalInput(d: Date): string {
  const local = new Date(d.getTime() + parisOffsetMs(d));
  return local.toISOString().slice(0, 16);
}
