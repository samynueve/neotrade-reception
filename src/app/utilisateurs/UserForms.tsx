"use client";

import { useActionState, useEffect, useRef } from "react";
import { FormField, PinInput } from "@/components/FormField";
import { useI18n } from "@/i18n/client";
import { createUserAction, resetPinAction, type UserFormState } from "@/lib/actions/users";
import { errorText } from "@/lib/client/errors";

function Result({ state }: { state: UserFormState }) {
  const { t } = useI18n();
  if (state?.ok)
    return (
      <p role="status" className="rounded-xl border-2 border-ok bg-green-50 p-3 font-bold text-ok">
        {state.ok === "added" ? t.users.added(state.name ?? "") : t.users.pinChanged}
      </p>
    );
  if (state?.errors?.form)
    return (
      <p role="alert" className="rounded-xl border-2 border-alert bg-red-50 p-3 font-bold text-alert">
        {errorText(t, state.errors.form)}
      </p>
    );
  return null;
}

export function NewUserForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<UserFormState, FormData>(createUserAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) form.current?.reset();
  }, [state]);
  const e = (k: string) => errorText(t, state?.errors?.[k]);
  return (
    <form ref={form} action={action} className="space-y-3">
      <FormField label={t.users.name} name="name" autoComplete="off" defaultValue={state?.values?.name} key={`n${state?.values?.name}`} error={e("name")} />
      <fieldset>
        <legend className="mb-1 font-bold">{t.users.role}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["CARISTE", "RESPONSABLE"] as const).map((v, i) => (
            <label key={v} className="flex min-h-14 items-center gap-2 rounded-xl border-2 border-brand-indigo/40 bg-white px-3 font-bold has-[:checked]:border-brand-indigo has-[:checked]:bg-brand-indigo has-[:checked]:text-white">
              <input type="radio" name="role" value={v} defaultChecked={state?.values?.role ? state.values.role === v : i === 0} key={`${v}${state?.values?.role}`} className="size-5" />
              {t.roles[v]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <PinInput label={t.users.pin} name="pin" error={e("pin")} />
        <PinInput label={t.users.pinConfirm} name="pin2" error={e("pin2")} />
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? t.users.submitting : t.users.submit}
      </button>
    </form>
  );
}

export function ResetPinForm({ userId }: { userId: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<UserFormState, FormData>(resetPinAction, undefined);
  const e = (k: string) => errorText(t, state?.errors?.[k]);
  return (
    <form action={action} className="mt-2 space-y-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-2 gap-3">
        <PinInput label={t.users.newPinField} name="pin" error={e("pin")} />
        <PinInput label={t.users.pinConfirm} name="pin2" error={e("pin2")} />
      </div>
      <Result state={state} />
      <button type="submit" disabled={pending} className="btn-outline w-full">
        {t.users.savePin}
      </button>
    </form>
  );
}
