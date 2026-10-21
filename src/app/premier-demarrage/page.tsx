import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Logo } from "@/components/Logo";
import { getI18n } from "@/i18n/server";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./SetupForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.setup.title };
}
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if ((await prisma.user.count()) > 0) redirect("/connexion");
  const { t } = await getI18n();
  return (
    <main id="contenu" className="flex min-h-dvh flex-col">
      <div className="bg-brand-indigo px-4 pb-6 pt-[max(1.5rem,env(safe-area-inset-top))] text-center text-white">
        <Logo className="text-3xl" />
        <h1 className="mt-2 text-lg font-bold">{t.setup.title}</h1>
      </div>
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
        <LanguagePicker compact />
        <p className="text-brand-ink/80">{t.setup.intro}</p>
        <SetupForm />
      </div>
    </main>
  );
}
