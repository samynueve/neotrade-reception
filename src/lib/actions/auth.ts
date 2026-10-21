"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { signIn, signOut } from "@/auth";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { getLocale } from "@/i18n/server";
import { isLocked } from "@/lib/pin-lock";
import { prisma } from "@/lib/prisma";
import { loginSchema, safeRedirect } from "@/lib/validation/auth";

/** `error` est un code traduit par l'écran de connexion. */
export type LoginState = { error?: string } | undefined;

const YEAR = 365 * 24 * 3600;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "invalid_input" };

  const user = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { lockedUntil: true, locale: true } });
  if (isLocked(user?.lockedUntil)) return { error: "locked" };

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeRedirect(formData.get("retour")) });
  } catch (error) {
    if (error instanceof AuthError) return { error: "pin_wrong" };
    // Connexion réussie (redirection) : la langue enregistrée de l'utilisateur suit sur ce téléphone,
    // sinon on retient celle choisie à l'écran de connexion
    if (isLocale(user?.locale)) (await cookies()).set(LOCALE_COOKIE, user.locale, { maxAge: YEAR, path: "/" });
    else await prisma.user.update({ where: { id: parsed.data.userId }, data: { locale: await getLocale() } });
    throw error;
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/connexion" });
}
