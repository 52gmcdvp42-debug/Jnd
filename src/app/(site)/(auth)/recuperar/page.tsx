import Link from "next/link";
import { Form, Submit } from "@/components/ui/Form";
import { Field } from "@/components/ui/Field";
import { forgotPasswordAction } from "@/app/actions/auth";

export const metadata = { title: "Recuperar contraseña" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-silver-600">Te enviaremos un enlace para crear una nueva contraseña.</p>
      <Form action={forgotPasswordAction} className="mt-6 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Submit className="btn-primary w-full" pendingText="Enviando…">Enviar enlace</Submit>
      </Form>
      <p className="mt-6 text-center text-sm"><Link href="/entrar" className="text-electric hover:underline">Volver a entrar</Link></p>
    </>
  );
}
