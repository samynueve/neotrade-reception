/**
 * Auth.js — connexion par nom (choisi dans la liste) + code PIN.
 * Session JWT de 12 h (une journée de travail). Le jeton ne contient que l'identifiant et le rôle ;
 * l'utilisateur est relu en base à chaque requête (lib/session.ts) pour qu'une désactivation prenne effet aussitôt.
 */
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { afterFailure, isLocked } from "@/lib/pin-lock";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";

// Empreinte factice : la comparaison est exécutée même si l'utilisateur est inconnu (temps de réponse constant)
const DUMMY_HASH = bcrypt.hashSync("0000", 10);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // AUTH_SECRET si défini ; sinon le secret JWT fourni par l'intégration Supabase de Vercel
  secret: process.env.AUTH_SECRET || process.env.SUPABASE_JWT_SECRET,
  session: { strategy: "jwt", maxAge: 12 * 3600 },
  pages: { signIn: "/connexion" },
  providers: [
    Credentials({
      credentials: { userId: {}, pin: {} },
      authorize: async (raw) => {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { id: parsed.data.userId } });
        const ok = await bcrypt.compare(parsed.data.pin, user?.pinHash ?? DUMMY_HASH);
        if (!user || !user.active || isLocked(user.lockedUntil)) return null;
        if (!ok) {
          await prisma.user.update({ where: { id: user.id }, data: afterFailure(user.failedPinAttempts) });
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
