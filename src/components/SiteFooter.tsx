import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getGeneralSettings } from "@/lib/settings";

export async function SiteFooter() {
  const s = await getGeneralSettings();
  return (
    <footer className="bg-navy text-silver-300">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 font-display text-sm font-semibold tracking-[0.25em] text-snow">{s.slogan}</p>
          <p className="mt-1 text-xs tracking-[0.25em] text-silver">{s.secondarySlogan}</p>
          <p className="mt-6 max-w-md text-xs leading-relaxed text-silver">
            Los contenidos de JND tienen finalidad exclusivamente educativa y no constituyen asesoramiento financiero ni recomendación de inversión. Invertir conlleva riesgos, incluida la pérdida del capital.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-snow">Academia</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/cursos" className="hover:text-white">Catálogo de cursos</Link></li>
            <li><Link href="/membresias" className="hover:text-white">Membresías</Link></li>
            <li><Link href="/sobre-jnd" className="hover:text-white">Sobre JND</Link></li>
            <li><Link href="/certificados/verificar" className="hover:text-white">Verificar certificado</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-snow">Legal</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/legal/aviso-legal" className="hover:text-white">Aviso legal</Link></li>
            <li><Link href="/legal/privacidad" className="hover:text-white">Privacidad</Link></li>
            <li><Link href="/legal/cookies" className="hover:text-white">Cookies</Link></li>
            <li><Link href="/legal/terminos" className="hover:text-white">Términos de contratación</Link></li>
          </ul>
          {s.contactEmail && <p className="mt-4 text-sm">{s.contactEmail}</p>}
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-silver">© {new Date().getFullYear()} JND. Todos los derechos reservados.</div>
    </footer>
  );
}
