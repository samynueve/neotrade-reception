import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Logo } from "@/components/Logo";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { safeRedirect } from "@/lib/validation/auth";
import { PinLogin } from "./PinLogin";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.login.title };
}
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ retour?: string; installe?: string }> }) {
  const sp = await searchParams;
  const returnTo = safeRedirect(sp.retour);
  if (await getCurrentUser()) redirect(returnTo);
  const { t } = await getI18n();

  const users = await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <main id="contenu" className="flex min-h-dvh flex-col">
      <div className="bg-brand-indigo px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
        <Logo className="text-3xl" />
        <h1 className="mt-2 text-lg font-bold">
          {t.app.tagline} <span className="text-brand-green">{t.app.taglineAccent}</span>
        </h1>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-6">
        {sp.installe && (
          <p role="status" className="mt-4 rounded-xl border-2 border-ok bg-green-50 p-3 font-bold text-ok">
            {t.login.installed}
          </p>
        )}
        {users.length === 0 ? (
          <div className="card mt-8 space-y-3 p-4 text-center">
            <p className="font-semibold">{t.login.noAccounts}</p>
            <Link href="/premier-demarrage" className="btn-primary w-full">
              {t.login.firstStart}
            </Link>
          </div>
        ) : (
          <PinLogin users={users} returnTo={returnTo} />
        )}
        <div className="mt-auto pt-8">
          <p className="mb-2 text-center text-sm font-bold text-brand-ink/70">{t.login.language}</p>
          <LanguagePicker compact />
        </div>
      </div>
    </main>
  );
}
