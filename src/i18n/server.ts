import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, matchAcceptLanguage, type Locale } from "./config";
import { DICTIONARIES } from "./dictionaries";
import { makeFormat } from "./format";

/** Langue de la requête : cookie (choix de l'utilisateur), sinon langue du navigateur. */
export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return matchAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LOCALE;
});

/** Dictionnaire et formats de la langue courante, pour les composants serveur. */
export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale], f: makeFormat(locale) };
}
