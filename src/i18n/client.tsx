"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { DICTIONARIES } from "./dictionaries";
import { makeFormat } from "./format";

const Ctx = createContext<Locale>("fr");

/** Fournit la langue aux composants client (le dictionnaire lui-même est chargé dans le bundle client). */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const locale = useContext(Ctx);
  return useMemo(() => ({ locale, t: DICTIONARIES[locale], f: makeFormat(locale) }), [locale]);
}
