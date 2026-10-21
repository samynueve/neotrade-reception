import type { Metadata } from "next";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { LanguagePicker } from "@/components/LanguagePicker";
import { getI18n } from "@/i18n/server";
import { requireUser } from "@/lib/session";
import { DevicePrefs, LogoutButton } from "./SettingsClient";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.settings.title };
}

export default async function SettingsPage() {
  const user = await requireUser("/reglages");
  const { t } = await getI18n();
  return (
    <>
      <AppHeader user={user} back={{ href: "/", label: t.common.home }} />
      <main id="contenu" className="mx-auto max-w-2xl space-y-5 px-4 pb-10 pt-4">
        <h1 className="text-2xl font-extrabold">{t.settings.title}</h1>

        <section className="card p-4">
          <h2 className="mb-3 text-lg font-extrabold">{t.settings.language}</h2>
          <LanguagePicker />
        </section>

        <DevicePrefs />

        <section className="card space-y-3 p-4">
          <h2 className="text-lg font-extrabold">{t.settings.account}</h2>
          <p>{t.settings.connectedAs(user.name, t.roles[user.role])}</p>
          {user.role === "RESPONSABLE" && (
            <Link href="/utilisateurs" className="btn-outline w-full text-base">
              {t.settings.manageUsers}
            </Link>
          )}
          <LogoutButton />
        </section>

        <section className="card space-y-1 p-4 text-brand-ink/80">
          <h2 className="mb-1 text-lg font-extrabold text-brand-ink">{t.settings.install}</h2>
          <p>{t.settings.installIos}</p>
          <p>{t.settings.installAndroid}</p>
        </section>

        <p className="text-center text-sm text-brand-ink/60">{t.settings.version(process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0")}</p>
      </main>
    </>
  );
}
