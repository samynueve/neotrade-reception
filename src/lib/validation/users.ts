import { z } from "zod";
import { pinSchema } from "./auth";

const name = z.string().trim().min(2, "name_short").max(40, "too_long_text");

const pins = { pin: pinSchema, pin2: z.string() };
const samePins = (d: { pin: string; pin2: string }) => d.pin === d.pin2;
const pinMismatch = { message: "pins_differ", path: ["pin2"] };

export const newUserSchema = z.object({ name, role: z.enum(["CARISTE", "RESPONSABLE"]), ...pins }).refine(samePins, pinMismatch);
export const firstManagerSchema = z.object({ name, setupCode: z.string().trim().min(1, "setup_required"), ...pins }).refine(samePins, pinMismatch);
export const resetPinSchema = z.object({ userId: z.string().min(1), ...pins }).refine(samePins, pinMismatch);

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}
