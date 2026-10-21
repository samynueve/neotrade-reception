"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

/** Change la langue : sur ce téléphone (cookie) et, si quelqu'un est connecté, dans son profil. */
export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { maxAge: 365 * 24 * 3600, path: "/", sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await prisma.user.update({ where: { id: user.id }, data: { locale } });
  revalidatePath("/", "layout");
}
