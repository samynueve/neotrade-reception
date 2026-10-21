import { z } from "zod";

export const PIN_MIN = 4;
export const PIN_MAX = 6;

export const pinSchema = z
  .string()
  .regex(new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`), "pin_format");

export const loginSchema = z.object({
  userId: z.string().min(1, "choose_name"),
  pin: pinSchema,
});

/** Évite les redirections vers un autre site après connexion. */
export function safeRedirect(value: FormDataEntryValue | null | undefined, fallback = "/"): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}
