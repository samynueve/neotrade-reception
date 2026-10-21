import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { getI18n } from "@/i18n/server";
import { toParisLocalInput } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { ImportFlow } from "./ImportFlow";
import { NewReceptionForm } from "./NewReceptionForm";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.importFlow.title };
}

export default async function NewReceptionPage({ searchParams }: { searchParams: Promise<{ manuel?: string }> }) {
  const user = await requireUser("/receptions/nouveau");
  const { t } = await getI18n();
  const manual = (await searchParams).manuel === "1";
  return (
    <>
      <AppHeader user={user} back={{ href: "/", label: t.common.home }} />
      <main id="contenu" className="mx-auto max-w-2xl px-4 pb-10 pt-4">
        {manual ? (
          <>
            <h1 className="mb-1 text-2xl font-extrabold">{t.manual.title}</h1>
            <p className="mb-4 text-brand-ink/75">
              {t.manual.intro}{" "}
              <Link href="/receptions/nouveau" className="font-semibold underline">
                {t.manual.photoInstead}
              </Link>
            </p>
            <NewReceptionForm now={toParisLocalInput(new Date())} />
          </>
        ) : (
          <ImportFlow />
        )}
      </main>
    </>
  );
}
