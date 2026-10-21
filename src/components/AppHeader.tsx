import Link from "next/link";
import { getI18n } from "@/i18n/server";
import type { CurrentUser } from "@/lib/session";
import { BackIcon } from "./BackIcon";
import { Logo } from "./Logo";
import { OnlineBadge } from "./OnlineBadge";

/**
 * En-tête : retour ou logo, état du réseau, et accès aux réglages (langue, son, déconnexion).
 * La déconnexion n'est plus à un seul toucher de l'en-tête : avec des gants, on sortait par erreur.
 */
export async function AppHeader({ user, back }: { user: CurrentUser; back?: { href: string; label: string } }) {
  const { t } = await getI18n();
  return (
    <header className="sticky top-0 z-10 bg-brand-indigo pt-[env(safe-area-inset-top)] text-white shadow-md">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-2">
        {back ? (
          <Link href={back.href} className="-ms-2 inline-flex min-h-12 items-center gap-1 rounded-xl pe-2 text-lg font-bold">
            <BackIcon /> {back.label}
          </Link>
        ) : (
          <Link href="/" className="flex min-h-12 flex-col justify-center leading-none" aria-label={t.common.home}>
            <Logo className="text-lg" />
            <span className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-green">{t.app.tagline}</span>
          </Link>
        )}
        <div className="ms-auto flex min-w-0 items-center gap-2">
          <OnlineBadge />
          <Link href="/reglages" aria-label={t.header.openSettings(user.name)} className="min-h-12 min-w-0 rounded-xl border-2 border-white/40 px-3 py-1 text-start text-sm leading-tight">
            <span className="block max-w-[8.5rem] truncate font-bold">{user.name}</span>
            <span className="block text-brand-green">{t.header.settings}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
