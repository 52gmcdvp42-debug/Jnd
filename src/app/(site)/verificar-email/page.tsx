import Link from "next/link";
import { verifyEmailToken } from "@/app/actions/auth";

export const metadata = { title: "Verificar email" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const ok = token ? await verifyEmailToken(token) : false;
  return (
    <div className="container-x py-20 text-center">
      <h1 className="text-2xl font-bold">{ok ? "Email confirmado" : "Enlace no válido"}</h1>
      <p className="mt-2 text-silver-600">{ok ? "Tu cuenta está verificada." : "El enlace ha caducado o ya se ha utilizado."}</p>
      <Link href="/cuenta" className="btn-primary mt-6">Ir a mi área</Link>
    </div>
  );
}
