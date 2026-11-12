"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

export type FormState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;
type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Formulario con estado (errores/éxito) para acciones de servidor. */
export function Form({
  action,
  children,
  className = "space-y-4",
  resetOnSuccess = false,
  confirm,
}: {
  action: Action;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <FormMessage state={state} />
    </form>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  if (state.message)
    return (
      <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {state.message}
      </p>
    );
  return null;
}

export function Submit({ children, className = "btn-primary", pendingText = "Guardando…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

/** Botón que ejecuta una acción simple (sin estado) con confirmación opcional. */
export function ActionButton({
  action,
  children,
  className = "btn-outline btn-sm",
  confirm,
  hidden,
}: {
  action: (fd: FormData) => Promise<void>;
  children: React.ReactNode;
  className?: string;
  confirm?: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Submit className={className} pendingText="…">
        {children}
      </Submit>
    </form>
  );
}
