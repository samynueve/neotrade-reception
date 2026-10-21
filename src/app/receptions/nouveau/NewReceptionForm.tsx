"use client";

import { useActionState, type InputHTMLAttributes } from "react";
import { useI18n } from "@/i18n/client";
import { createReceptionAction, type ReceptionFormState } from "@/lib/actions/reception";
import { errorText } from "@/lib/client/errors";

/** Saisie manuelle d'un camion (pas de document, ou lecture automatique indisponible). */
export function NewReceptionForm({ now }: { now: string }) {
  const { t } = useI18n();
  const m = t.manual;
  const [state, action, pending] = useActionState<ReceptionFormState, FormData>(createReceptionAction, undefined);
  const e = (k: string) => errorText(t, state?.errors?.[k]);
  const hasErrors = Object.keys(state?.errors ?? {}).length > 0;
  // Après une erreur, chaque champ reprend sa valeur (la clé du formulaire force React à réappliquer les valeurs)
  const v = (k: string, fallback?: string) => ({ defaultValue: state?.values?.[k] ?? fallback });

  return (
    <form action={action} key={state?.values ? JSON.stringify(state.values) : "vide"} className="space-y-5">
      <fieldset className="card space-y-4 p-4">
        <legend className="px-1 text-lg font-extrabold">{m.cmr}</legend>
        <Input label={m.listNumber} name="loadingListNumber" {...v("loadingListNumber")} placeholder="80977/652747" inputMode="numeric" dir="ltr" error={e("loadingListNumber")} />
        <Input label={m.documentDate} name="documentDate" {...v("documentDate")} type="datetime-local" error={e("documentDate")} />
      </fieldset>

      <fieldset className="card space-y-4 p-4">
        <legend className="px-1 text-lg font-extrabold">{m.fahrauftrag}</legend>
        <Input label={m.reise} name="tripNumber" {...v("tripNumber")} inputMode="numeric" dir="ltr" error={e("tripNumber")} />
        <div className="grid grid-cols-2 gap-3">
          <Input label={m.vehicle} name="vehiclePlate" {...v("vehiclePlate")} autoCapitalize="characters" dir="ltr" error={e("vehiclePlate")} />
          <Input label={m.trailer} name="trailerPlate" {...v("trailerPlate")} autoCapitalize="characters" dir="ltr" error={e("trailerPlate")} />
        </div>
        <Input label={m.seals} name="sealsExpected" {...v("sealsExpected")} hint={m.sealsHint} autoCapitalize="characters" dir="ltr" error={e("sealsExpected")} />
      </fieldset>

      <fieldset className="card space-y-4 p-4">
        <legend className="px-1 text-lg font-extrabold">{m.totals}</legend>
        <div className="grid grid-cols-2 gap-3">
          <Input label={m.packages} name="expectedPackages" {...v("expectedPackages")} inputMode="numeric" dir="ltr" error={e("expectedPackages")} />
          <Input label={m.weight} name="expectedWeightKg" {...v("expectedWeightKg")} inputMode="decimal" dir="ltr" error={e("expectedWeightKg")} />
        </div>
        <Input label={m.value} name="expectedValueEur" {...v("expectedValueEur")} inputMode="decimal" dir="ltr" error={e("expectedValueEur")} />
      </fieldset>

      <fieldset className="card space-y-4 p-4">
        <legend className="px-1 text-lg font-extrabold">{m.arrival}</legend>
        <Input label={m.arrivedAt} name="arrivedAt" {...v("arrivedAt", now)} type="datetime-local" error={e("arrivedAt")} />
        <div>
          <label htmlFor="f-comment" className="mb-1 block font-bold">
            {m.comment}
          </label>
          <textarea id="f-comment" name="comment" {...v("comment")} rows={3} className="w-full rounded-xl border-2 border-brand-indigo/40 bg-white p-3 text-lg" />
        </div>
      </fieldset>

      {hasErrors && (
        <p role="alert" className="rounded-xl border-2 border-alert bg-red-50 p-3 font-bold text-alert">
          {m.fixFields}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary min-h-18 w-full text-2xl">
        {pending ? m.creating : m.create}
      </button>
    </form>
  );
}

function Input({ label, name, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string }) {
  const id = `f-${name}`;
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className="h-14 w-full rounded-xl border-2 border-brand-indigo/40 bg-white px-3 text-lg aria-[invalid=true]:border-alert aria-[invalid=true]:bg-red-50"
        {...props}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-brand-ink/70">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 font-bold text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
