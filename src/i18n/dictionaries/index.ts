import type { Locale } from "../config";
import { ar } from "./ar";
import { de } from "./de";
import { en } from "./en";
import { fr, type Dict } from "./fr";

export type { Dict };
export const DICTIONARIES: Record<Locale, Dict> = { fr, en, de, ar };
