import "server-only";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "./prisma";

/** Utilisateur connecté et actif, relu en base. Mis en cache pour la requête. */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findFirst({
    where: { id: session.user.id, active: true },
    select: { id: true, name: true, role: true },
  });
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Redirige vers la connexion si personne n'est connecté. */
export async function requireUser(returnTo = "/"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?retour=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Réservé à certains rôles (ex. clôture d'une réception par un responsable). */
export async function requireRole(roles: Role[], returnTo = "/"): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (!roles.includes(user.role)) redirect("/?refuse=1");
  return user;
}
