import type { Metadata } from "next";
import { AppHeader } from "@/components/AppHeader";
import { getI18n } from "@/i18n/server";
import { toggleActiveAction } from "@/lib/actions/users";
import { isLocked } from "@/lib/pin-lock";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { NewUserForm, ResetPinForm } from "./UserForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getI18n()).t.users.title };
}
export const dynamic = "force-dynamic";

/** Gestion des comptes (responsables uniquement) : ajout, nouveau PIN, déblocage, désactivation. */
export default async function UsersPage() {
  const me = await requireRole(["RESPONSABLE"], "/utilisateurs");
  const { t, f } = await getI18n();
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, active: true, lockedUntil: true, lastLoginAt: true },
  });

  return (
    <>
      <AppHeader user={me} back={{ href: "/reglages", label: t.settings.title }} />
      <main id="contenu" className="mx-auto max-w-2xl space-y-5 px-4 pb-10 pt-4">
        <h1 className="text-2xl font-extrabold">{t.users.title}</h1>

        <section className="card p-4">
          <h2 className="mb-3 text-lg font-extrabold">{t.users.add}</h2>
          <NewUserForm />
        </section>

        <ul className="space-y-3">
          {users.map((u) => {
            const locked = isLocked(u.lockedUntil);
            return (
              <li key={u.id} className={`card p-4 ${u.active ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-extrabold">{u.name}</p>
                    <p className="text-sm text-brand-ink/75">
                      {t.roles[u.role]}
                      {!u.active && t.users.deactivated}
                      {locked && <b className="text-alert">{t.users.locked}</b>}
                      {u.lastLoginAt && t.users.lastLogin(f.date(u.lastLoginAt))}
                    </p>
                  </div>
                  {u.id !== me.id && (
                    <form action={toggleActiveAction}>
                      <input type="hidden" name="userId" value={u.id} />
                      <button type="submit" className="btn-outline min-h-12 px-3 text-sm">
                        {u.active ? t.users.deactivate : t.users.reactivate}
                      </button>
                    </form>
                  )}
                </div>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer font-bold text-brand-green-text">
                    {t.users.newPin}
                    {locked && t.users.unlock}
                  </summary>
                  <ResetPinForm userId={u.id} />
                </details>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
