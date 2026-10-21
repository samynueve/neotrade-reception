import type { InputHTMLAttributes } from "react";

/** Champ de formulaire à gros caractères, avec message d'erreur relié pour les lecteurs d'écran. */
export function FormField({ label, name, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string }) {
  const id = `f-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-bold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="h-14 w-full rounded-xl border-2 border-brand-indigo/40 bg-white px-3 text-lg aria-[invalid=true]:border-alert aria-[invalid=true]:bg-red-50"
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 font-bold text-alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Champ code PIN : clavier numérique, chiffres masqués. */
export function PinInput(props: { label: string; name: string; error?: string }) {
  return <FormField type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="new-password" maxLength={6} dir="ltr" {...props} />;
}
