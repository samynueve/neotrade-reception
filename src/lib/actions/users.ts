"use server";

import bcrypt from "bcryptjs";
import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { fieldErrors, firstManagerSchema, newUserSchema, resetPinSchema } from "@/lib/validation/users";

/** Les erreurs sont des codes traduits à l'affichage ; `ok` indique le message de réussite à afficher. */
export type UserFormState = { errors?: Record<string, string>; ok?: "added" | "pin_changed"; name?: string; values?: Record<string, string> } | undefined;

// Valeurs renvoyées au formulaire en cas d'erreur (jamais les PIN)
const keep = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Premier démarrage : création du premier responsable depuis le téléphone, sans ordinateur.
 * Possible uniquement tant qu'aucun utilisateur n'existe, et avec le code SETUP_CODE défini sur le serveur.
 */
export async function setupFirstManagerAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const values = keep(formData, ["name", "setupCode"]);
  const parsed = firstManagerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const expected = process.env.SETUP_CODE;
  if (!expected) return { errors: { form: "setup_missing" }, values };
  if (!sameText(parsed.data.setupCode, expected)) return { errors: { setupCode: "setup_wrong" }, values: { ...values, setupCode: "" } };
  if ((await prisma.user.count()) > 0) return { errors: { form: "already_installed" } };

  await prisma.user.create({ data: { name: parsed.data.name, role: "RESPONSABLE", pinHash: await bcrypt.hash(parsed.data.pin, 10), locale: await getLocale() } });
  redirect("/connexion?installe=1");
}

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireRole(["RESPONSABLE"], "/utilisateurs");
  const values = keep(formData, ["name", "role"]);
  const parsed = newUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (await prisma.user.findUnique({ where: { name: parsed.data.name } })) return { errors: { name: "name_taken" }, values };
  await prisma.user.create({ data: { name: parsed.data.name, role: parsed.data.role, pinHash: await bcrypt.hash(parsed.data.pin, 10) } });
  revalidatePath("/utilisateurs");
  return { ok: "added", name: parsed.data.name };
}

/** Nouveau PIN (oubli) ; débloque aussi le compte. */
export async function resetPinAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireRole(["RESPONSABLE"], "/utilisateurs");
  const parsed = resetPinSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await prisma.user.update({
    where: { id: parsed.data.userId },
    data: { pinHash: await bcrypt.hash(parsed.data.pin, 10), failedPinAttempts: 0, lockedUntil: null },
  });
  revalidatePath("/utilisateurs");
  return { ok: "pin_changed" };
}

export async function toggleActiveAction(formData: FormData): Promise<void> {
  const me = await requireRole(["RESPONSABLE"], "/utilisateurs");
  const id = String(formData.get("userId") ?? "");
  if (!id || id === me.id) return; // on ne se désactive pas soi-même
  const user = await prisma.user.findUnique({ where: { id }, select: { active: true } });
  if (!user) return;
  await prisma.user.update({ where: { id }, data: { active: !user.active, failedPinAttempts: 0, lockedUntil: null } });
  revalidatePath("/utilisateurs");
}
