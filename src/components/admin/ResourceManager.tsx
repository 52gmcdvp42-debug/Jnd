import type { Resource } from "@prisma/client";
import { Form, Submit, ActionButton } from "@/components/ui/Form";
import { Field, Checkbox } from "@/components/ui/Field";
import { addResourceAction, deleteResourceAction } from "@/app/actions/admin/content";
import { Section } from "@/components/admin/PageHeader";

function size(n: number | null) {
  if (!n) return "";
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
}

export function ResourceManager({ target, targetId, resources }: { target: "course" | "module" | "lesson"; targetId: string; resources: Resource[] }) {
  return (
    <Section title="Materiales y recursos" description="PDF, plantillas, hojas de cálculo o enlaces complementarios. Los materiales privados solo los descargan alumnos con acceso (enlaces temporales).">
      {resources.length > 0 && (
        <ul className="mb-5 divide-y divide-silver-300/40 rounded-lg border border-silver-300/50">
          {resources.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{r.title}</span>
                <span className="ml-2 text-xs text-silver-600">{r.externalUrl ? "Enlace" : `${r.fileName} · ${size(r.sizeBytes)}`} · {r.isPublic ? "Público" : "Privado"}</span>
              </span>
              <span className="flex gap-2">
                <a href={`/api/resources/${r.id}/download`} className="btn-outline btn-sm">Ver</a>
                <ActionButton action={deleteResourceAction} hidden={{ id: r.id }} className="btn-outline btn-sm text-red-600" confirm={`¿Eliminar «${r.title}»?`}>Eliminar</ActionButton>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Form action={addResourceAction} className="grid gap-4 sm:grid-cols-2" resetOnSuccess>
        <input type="hidden" name="target" value={target} />
        <input type="hidden" name="targetId" value={targetId} />
        <Field label="Título" name="title" placeholder="Ej.: Guía en PDF" />
        <Field label="Descripción (opcional)" name="description" />
        <label className="block">
          <span className="label">Archivo</span>
          <input type="file" name="file" className="input file:mr-3 file:rounded file:border-0 file:bg-navy file:px-3 file:py-1 file:text-snow" />
          <span className="hint block">Máximo 200 MB.</span>
        </label>
        <Field label="…o enlace externo" name="externalUrl" type="url" placeholder="https://" />
        <div className="sm:col-span-2"><Checkbox label="Material público" name="isPublic" hint="Cualquiera podrá descargarlo, aunque no haya comprado (útil para muestras)." /></div>
        <div><Submit pendingText="Subiendo…">Añadir material</Submit></div>
      </Form>
    </Section>
  );
}
