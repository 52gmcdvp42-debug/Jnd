import Link from "next/link";
import { getGeneralSettings } from "@/lib/settings";
import { RichText } from "@/components/RichText";

export const metadata = { title: "Sobre JND" };

export default async function AboutPage() {
  const s = await getGeneralSettings();
  return (
    <>
      <section className="bg-grid bg-navy py-20 text-snow">
        <div className="container-x">
          <p className="eyebrow">Sobre JND</p>
          <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{s.slogan}</h1>
          <p className="mt-3 tracking-[0.3em] text-silver">{s.secondarySlogan}</p>
        </div>
      </section>
      <section className="container-x grid gap-12 py-16 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RichText text={s.aboutText} className="prose-jnd text-base" />
        </div>
        <aside className="card h-fit p-6">
          <h2 className="font-semibold">Qué encontrarás</h2>
          <ul className="mt-4 space-y-2 text-sm text-silver-600">
            {["Educación financiera", "Bitcoin y criptomonedas", "Mercados financieros", "Inversión", "Análisis técnico y fundamental", "Gestión del riesgo", "Mentalidad y desarrollo personal"].map((x) => (
              <li key={x} className="flex gap-2"><span className="text-electric">▸</span>{x}</li>
            ))}
          </ul>
          <Link href="/cursos" className="btn-primary mt-6 w-full">Ver formaciones</Link>
        </aside>
      </section>
    </>
  );
}
