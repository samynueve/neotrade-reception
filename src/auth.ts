/**
 * Auth.js — connexion par nom (choisi dans la liste) + code PIN.
 * Session JWT de 12 h (une journée de travail). Le jeton ne contient que l'identifiant et le rôle ;
 * l'utilisateur est relu en base à chaque requête (lib/session.ts) pour qu'une désactivation prenne effet aussitôt.
 */
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { lockEnd, MAX_PIN_ATTEMPTS } from "@/lib/pin-lock";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";

// Empreinte factice : la comparaison est exécutée même si l'utilisateur est inconnu (temps de réponse constant)
const DUMMY_HASH = bcrypt.hashSync("0000", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // AUTH_SECRET si défini ; sinon dérivé du mot de passe de la base fourni par l'intégration Supabase (jamais exposé)
  secret:
    process.env.AUTH_SECRET ||
    (process.env.POSTGRES_PASSWORD &&
      createHash("sha256").update(`neotrade-reception:auth:${process.env.POSTGRES_PASSWORD}`).digest("base64")) ||
    undefined,
  session: { strategy: "jwt", maxAge: 12 * 3600 },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: { userId: {}, pin: {} },
      authorize: async (raw) => {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { userId, pin } = parsed.data;
        const now = new Date();
        // L'essai est compté AVANT la comparaison, en une seule requête : des connexions envoyées en rafale
        // ne peuvent pas tester plus de MAX_PIN_ATTEMPTS codes (PostgreSQL relit la condition ligne verrouillée)
        const reserved = await prisma.user.updateMany({
          where: { id: userId, active: true, failedPinAttempts: { lt: MAX_PIN_ATTEMPTS }, OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }] },
          data: { failedPinAttempts: { increment: 1 } },
        });
        const user = reserved.count ? await prisma.user.findUnique({ where: { id: userId } }) : null;
        const ok = await bcrypt.compare(pin, user?.pinHash ?? DUMMY_HASH);
        if (!user) return null;
        if (!ok) {
          // Dernier essai autorisé raté : blocage, et le compteur repart à zéro pour l'après-blocage
          await prisma.user.updateMany({
            where: { id: user.id, failedPinAttempts: { gte: MAX_PIN_ATTEMPTS } },
            data: { failedPinAttempts: 0, lockedUntil: lockEnd(now) },
          });
          return null;
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { failedPinAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });
        return { id: user.id, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
});
