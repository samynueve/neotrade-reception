"use client";

import { useActionState } from "react";
import { FormField, PinInput } from "@/components/FormField";
import { useI18n } from "@/i18n/client";
import { setupFirstManagerAction, type UserFormState } from "@/lib/actions/users";
import { errorText } from "@/lib/client/errors";

export function SetupForm() {
  const { t } = useI18n();
  const [state, action, pending] = useActionState<UserFormState, FormData>(setupFirstManagerAction, undefined);
  const e = (k: string) => errorText(t, state?.errors?.[k]);
  return (
    <form action={action} className="card space-y-4 p-4">
      <FormField label={t.setup.setupCode} name="setupCode" autoComplete="off" autoCapitalize="none" defaultValue={state?.values?.setupCode} key={`c${state?.values?.setupCode}`} error={e("setupCode")} />
      <FormField label={t.setup.name} name="name" autoComplete="name" defaultValue={state?.values?.name} key={`n${state?.values?.name}`} error={e("name")} />
      <PinInput label={t.setup.pin} name="pin" error={e("pin")} />
      <PinInput label={t.setup.pinConfirm} name="pin2" error={e("pin2")} />
      {e("form") && (
        <p role="alert" className="rounded-xl border-2 border-alert bg-red-50 p-3 font-bold text-alert">
          {e("form")}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary min-h-16 w-full text-xl">
        {pending ? t.setup.submitting : t.setup.submit}
      </button>
    </form>
  );
}
