import { requireAdmin } from "@/lib/auth/session";
import { getCertificateSettings, getCompanySettings, getGeneralSettings, getLegalPage } from "@/lib/settings";
import { LEGAL_SLUGS } from "@/lib/legal-defaults";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { Form, Submit } from "@/components/ui/Form";
import { Field, TextArea, Checkbox } from "@/components/ui/Field";
import { saveCompanySettingsAction, saveGeneralSettingsAction, saveLegalPageAction } from "@/app/actions/admin/settings";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  await requireAdmin();
  const [g, c, cert, legal] = await Promise.all([getGeneralSettings(), getCompanySettings(), getCertificateSettings(), Promise.all(LEGAL_SLUGS.map(async (s) => ({ slug: s, ...(await getLegalPage(s)) })))]);
  return (
    <>
      <PageHeader title="Ajustes generales" />
      <div className="space-y-6">
        <Section title="Web y marca">
          <Form action={saveGeneralSettingsAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" name="siteName" defaultValue={g.siteName} />
            <Field label="Email de contacto" name="contactEmail" type="email" defaultValue={g.contactEmail} />
            <Field label="Eslogan principal" name="slogan" defaultValue={g.slogan} />
            <Field label="Eslogan secundario" name="secondarySlogan" defaultValue={g.secondarySlogan} />
            <Field label="Titular de la portada" name="heroTitle" defaultValue={g.heroTitle} className="sm:col-span-2" />
            <TextArea label="Texto de la portada" name="heroText" defaultValue={g.heroText} rows={3} className="sm:col-span-2" />
            <TextArea label="Presentación de JND (página «Sobre JND»)" name="aboutText" defaultValue={g.aboutText} rows={8} className="sm:col-span-2" />
            <Checkbox label="Registro de nuevos alumnos abierto" name="registrationOpen" defaultChecked={g.registrationOpen} />
            <Checkbox label="Exigir verificar el email para entrar" name="requireEmailVerification" defaultChecked={g.requireEmailVerification} hint="Requiere tener configurado el envío de correos." />
            <div className="sm:col-span-2"><Submit>Guardar</Submit></div>
          </Form>
        </Section>
        <Section title="Datos de la empresa y certificados">
          <Form action={saveCompanySettingsAction} className="grid gap-4 sm:grid-cols-2">
            <Field label="Razón social" name="legalName" defaultValue={c.legalName} />
            <Field label="NIF/CIF" name="taxId" defaultValue={c.taxId} />
            <Field label="Dirección" name="address" defaultValue={c.address} className="sm:col-span-2" />
            <Field label="Email legal" name="email" defaultValue={c.email} />
            <Field label="Datos registrales" name="registry" defaultValue={c.registry} />
            <Field label="Firma del certificado (nombre)" name="signerName" defaultValue={cert.signerName} />
            <Field label="Cargo del firmante" name="signerTitle" defaultValue={cert.signerTitle} />
            <div className="sm:col-span-2"><Submit>Guardar</Submit></div>
          </Form>
        </Section>
        <Section title="Páginas legales" description="Plantillas de partida con campos [ENTRE CORCHETES] que debes completar. Revísalas con un profesional jurídico antes de abrir la web al público.">
          <div className="space-y-3">
            {legal.map((l) => (
              <details key={l.slug} className="rounded-lg border border-silver-300/60">
                <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{l.title} <span className="text-xs text-silver-600">/legal/{l.slug}{l.body.includes("[") && " · pendiente de completar"}</span></summary>
                <div className="border-t border-silver-300/50 p-4">
                  <Form action={saveLegalPageAction}>
                    <input type="hidden" name="slug" value={l.slug} />
                    <Field label="Título" name="title" defaultValue={l.title} />
                    <TextArea label="Contenido" name="body" defaultValue={l.body} rows={18} />
                    <Submit>Guardar página</Submit>
                  </Form>
                </div>
              </details>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}
