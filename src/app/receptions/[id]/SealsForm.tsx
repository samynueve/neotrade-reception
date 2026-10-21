"use client";

import { useActionState } from "react";
import { useI18n } from "@/i18n/client";
import { saveSealsFoundAction } from "@/lib/actions/reception";

/** Saisie des plombs constatés à l'ouverture de la remorque. */
export function SealsForm({ receptionId, current }: { receptionId: string; current: string[] }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(saveSealsFoundAction, undefined);
  return (
    <form action={action} className="mt-3 space-y-2 border-t-2 border-brand-indigo/10 pt-3">
      <input type="hidden" name="receptionId" value={receptionId} />
      <label htmlFor="seals-found" className="block font-bold">
        {t.reception.sealsFormLabel}
      </label>
      <div className="flex gap-2">
        <input
          id="seals-found"
          name="seals"
          defaultValue={current.join(", ")}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          dir="ltr"
          aria-describedby="seals-hint"
          className="h-14 min-w-0 flex-1 rounded-xl border-2 border-brand-indigo/40 bg-white px-3 font-mono text-lg"
        />
        <button type="submit" disabled={pending} className="btn-primary px-4 text-base">
          {t.common.save}
        </button>
      </div>
      <p id="seals-hint" className="text-sm text-brand-ink/70">
        {state?.ok ? <b className="text-ok">{t.reception.sealsSaved}</b> : t.reception.sealsFormHint}
      </p>
    </form>
  );
}
