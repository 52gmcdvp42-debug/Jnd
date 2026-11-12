import Link from "next/link";
import { Form, Submit } from "@/components/ui/Form";
import { Field } from "@/components/ui/Field";
import { resetPasswordAction } from "@/app/actions/auth";

export const metadata = { title: "Nueva contraseña" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold">Nueva contraseña</h1>
      {!token ? (
        <p className="mt-4 text-sm text-red-700">Enlace no válido. <Link href="/recuperar" className="underline">Solicita uno nuevo</Link>.</p>
      ) : (
        <Form action={resetPasswordAction} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          <Field label="Nueva contraseña" name="password" type="password" autoComplete="new-password" required minLength={10} hint="Mínimo 10 caracteres, con letras y números." />
          <Submit className="btn-primary w-full">Guardar contraseña</Submit>
        </Form>
      )}
      <p className="mt-6 text-center text-sm"><Link href="/entrar" className="text-electric hover:underline">Ir a entrar</Link></p>
    </>
  );
}
