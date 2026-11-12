"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { checkoutAction } from "@/app/actions/checkout";

function Btn({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Redirigiendo al pago…" : children}
    </button>
  );
}

export function BuyButton({
  kind,
  id,
  interval,
  back,
  children,
  className = "btn-primary w-full",
}: {
  kind: "course" | "module" | "plan";
  id: string;
  interval?: "MONTH" | "YEAR";
  back: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, action] = useActionState(checkoutAction, null);
  return (
    <form action={action} className="w-full">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="id" value={id} />
      {interval && <input type="hidden" name="interval" value={interval} />}
      <input type="hidden" name="back" value={back} />
      <Btn className={className}>{children}</Btn>
      {state?.error && <p role="alert" className="mt-2 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
