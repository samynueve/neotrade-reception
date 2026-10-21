import { INTL_LOCALE, type Locale } from "./config";

/** Fuseau du quai : toutes les heures sont affichées en heure de Douvrin. */
const TZ = "Europe/Paris";

export type Fmt = ReturnType<typeof makeFormat>;

/** Formats de dates et de nombres propres à chaque langue. */
export function makeFormat(locale: Locale) {
  const tag = INTL_LOCALE[locale];
  const date = new Intl.DateTimeFormat(tag, { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  const time = new Intl.DateTimeFormat(tag, { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const num = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 });
  const eur = new Intl.NumberFormat(tag, { style: "currency", currency: "EUR" });
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(tag) + s.slice(1);
  return {
    date: (d: Date | string) => cap(date.format(new Date(d))),
    time: (d: Date | string) => time.format(new Date(d)),
    num: (n: number) => num.format(n),
    kg: (n: number) => `${num.format(n)} kg`,
    eur: (euros: number) => eur.format(euros),
  };
}
