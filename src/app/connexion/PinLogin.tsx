"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { useI18n } from "@/i18n/client";
import { PIN_MAX, PIN_MIN } from "@/lib/validation/auth";

type U = { id: string; name: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "effacer", "0", "valider"] as const;

/** Étape 1 : toucher son nom. Étape 2 : taper son code PIN sur le pavé (grosses touches, utilisable avec des gants). */
export function PinLogin({ users, returnTo }: { users: U[]; returnTo: string }) {
  const [user, setUser] = useState<U | null>(null);
  const [pin, setPin] = useState("");
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const { t } = useI18n();
  const errorText = state?.error ? ((t.errors as Record<string, string>)[state.error] ?? t.common.unknownError) : null;

  // Après une erreur, on vide le code pour une nouvelle saisie
  useEffect(() => {
    if (state?.error) setPin("");
  }, [state]);

  if (!user) {
    return (
      <section className="mt-6">
        <h2 className="mb-3 text-xl font-bold">{t.login.whoAreYou}</h2>
        <ul className="grid grid-cols-2 gap-3">
          {users.map((u) => (
            <li key={u.id}>
              <button type="button" onClick={() => setUser(u)} className="btn-outline min-h-20 w-full text-xl">
                {u.name}
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const press = (k: (typeof KEYS)[number]) => {
    if (k === "effacer") setPin((p) => p.slice(0, -1));
    else if (k === "valider") formRef.current?.requestSubmit();
    else setPin((p) => (p.length < PIN_MAX ? p + k : p));
  };

  return (
    <section className="mt-6 flex flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{t.login.pinOf(user.name)}</h2>
        <button type="button" className="btn-outline min-h-12 px-3 text-base" onClick={() => (setUser(null), setPin(""))}>
          {t.login.change}
        </button>
      </div>

      <form ref={formRef} action={action} className="mt-4">
        <input type="hidden" name="userId" value={user.id} />
        <input type="hidden" name="retour" value={returnTo} />
        <input type="hidden" name="pin" value={pin} />
        <div aria-live="polite" aria-label={t.login.digitsTyped(pin.length)} dir="ltr" className="card flex h-20 items-center justify-center gap-4">
          {Array.from({ length: Math.max(PIN_MIN, pin.length) }, (_, i) => (
            <span key={i} aria-hidden className={`size-5 rounded-full border-2 border-brand-indigo ${i < pin.length ? "bg-brand-ink" : ""}`} />
          ))}
        </div>
        {errorText && (
          <p role="alert" className="mt-3 rounded-xl border-2 border-alert bg-red-100 p-3 text-lg font-bold text-alert">
            {errorText}
          </p>
        )}
      </form>

      {/* Pavé numérique toujours dans le même sens, comme sur un téléphone */}
      <div dir="ltr" className="mt-4 grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={pending || (k === "valider" && pin.length < PIN_MIN)}
            onClick={() => press(k)}
            className={
              k === "valider"
                ? "btn-primary min-h-20 text-xl"
                : k === "effacer"
                  ? "btn-outline min-h-20 text-base"
                  : "btn-outline min-h-20 text-3xl"
            }
          >
            {k === "valider" ? (pending ? "…" : t.common.ok) : k === "effacer" ? t.login.erase : k}
          </button>
        ))}
      </div>
    </section>
  );
}
