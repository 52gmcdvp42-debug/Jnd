import Link from "next/link";
import { redirect } from "next/navigation";
import { Form, Submit } from "@/components/ui/Form";
import { Field } from "@/components/ui/Field";
import { registerAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { getGeneralSettings } from "@/lib/settings";

export const metadata = { title: "Crear cuenta" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/cuenta");
  const settings = await getGeneralSettings();
  return (
    <>
      <h1 className="text-2xl font-bold">Crea tu cuenta</h1>
      <p className="mt-1 text-sm text-silver-600">THE FUTURE STARTS HERE.</p>
      {!settings.registrationOpen ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">El registro está cerrado temporalmente.</p>
      ) : (
        <Form action={registerAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Nombre y apellidos" name="name" autoComplete="name" required hint="Aparecerá en tus certificados." />
          <Field label="Email" name="email" type="email" autoComplete="email" required />
          <Field label="Contraseña" name="password" type="password" autoComplete="new-password" required minLength={10} hint="Mínimo 10 caracteres, con letras y números." />
          <label className="flex items-start gap-2 text-sm text-silver-600">
            <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 accent-electric" />
            <span>
              Acepto los <Link href="/legal/terminos" className="text-electric underline" target="_blank">términos</Link> y la{" "}
              <Link href="/legal/privacidad" className="text-electric underline" target="_blank">política de privacidad</Link>.
            </span>
          </label>
          <Submit className="btn-primary w-full" pendingText="Creando cuenta…">Crear cuenta</Submit>
        </Form>
      )}
      <p className="mt-6 text-center text-sm text-silver-600">
        ¿Ya tienes cuenta? <Link href="/entrar" className="font-semibold text-electric hover:underline">Entrar</Link>
      </p>
    </>
  );
}
