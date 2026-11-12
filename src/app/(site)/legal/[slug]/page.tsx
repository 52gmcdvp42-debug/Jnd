import { notFound } from "next/navigation";
import { LEGAL_SLUGS, type LegalSlug } from "@/lib/legal-defaults";
import { getLegalPage } from "@/lib/settings";
import { RichText } from "@/components/RichText";
import { formatDate } from "@/lib/format";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LEGAL_SLUGS.includes(slug as LegalSlug)) return {};
  return { title: (await getLegalPage(slug as LegalSlug)).title };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!LEGAL_SLUGS.includes(slug as LegalSlug)) notFound();
  const page = await getLegalPage(slug as LegalSlug);
  return (
    <div className="container-x max-w-3xl py-14">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-2 text-3xl font-bold">{page.title}</h1>
      {page.updatedAt && <p className="mt-1 text-sm text-silver-600">Última actualización: {formatDate(page.updatedAt)}</p>}
      <RichText text={page.body} className="prose-jnd mt-8" />
    </div>
  );
}
