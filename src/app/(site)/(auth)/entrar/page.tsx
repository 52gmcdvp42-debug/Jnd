import Link from "next/link";
import { redirect } from "next/navigation";
import { Form, Submit } from "@/components/ui/Form";
import { Field } from "@/components/ui/Field";
import { loginAction } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect("/cuenta");
  return (
    <>
      <h1 className="text-2xl font-bold">Bienvenido de nuevo</h1>
      <p className="mt-1 text-sm text-silver-600">Accede a tu área de aprendizaje.</p>
      <Form action={loginAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required />
        <div className="text-right text-sm">
          <Link href="/recuperar" className="text-electric hover:underline">¿Has olvidado tu contraseña?</Link>
        </div>
        <Submit className="btn-primary w-full" pendingText="Entrando…">Entrar</Submit>
      </Form>
      <p className="mt-6 text-center text-sm text-silver-600">
        ¿No tienes cuenta? <Link href={`/registro${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-electric hover:underline">Regístrate</Link>
      </p>
    </>
  );
}
