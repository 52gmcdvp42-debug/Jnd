import { redirect } from "next/navigation";

export const metadata = { title: "Verificar certificado" };

async function go(fd: FormData) {
  "use server";
  const code = String(fd.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 30);
  if (code) redirect(`/certificados/verificar/${code}`);
}

export default function VerifyIndex() {
  return (
    <div className="container-x max-w-xl py-20">
      <p className="eyebrow">Certificados</p>
      <h1 className="mt-2 text-3xl font-bold">Verificar un certificado</h1>
      <p className="mt-2 text-silver-600">Introduce el identificador que aparece en el certificado (formato JND-XXXX-XXXX-XXXX).</p>
      <form action={go} className="mt-6 flex gap-2">
        <input name="code" required placeholder="JND-XXXX-XXXX-XXXX" className="input uppercase" />
        <button className="btn-primary">Verificar</button>
      </form>
    </div>
  );
}
