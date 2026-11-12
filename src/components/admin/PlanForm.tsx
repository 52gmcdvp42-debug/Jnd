import type { MembershipPlan } from "@prisma/client";
import { Form, Submit } from "@/components/ui/Form";
import { Field, TextArea, Checkbox } from "@/components/ui/Field";
import { savePlanAction } from "@/app/actions/admin/commerce";
import { centsToInput } from "@/lib/format";

type Opt = { id: string; name: string };

export function PlanForm({ plan, courses, categories, courseIds = [], categoryIds = [] }: { plan?: MembershipPlan; courses: Opt[]; categories: Opt[]; courseIds?: string[]; categoryIds?: string[] }) {
  return (
    <Form action={savePlanAction} className="grid gap-4 sm:grid-cols-2">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <Field label="Nombre del nivel" name="name" defaultValue={plan?.name} required />
      <Field label="Orden" name="sortOrder" type="number" defaultValue={plan?.sortOrder ?? 0} />
      <TextArea label="Descripción" name="description" defaultValue={plan?.description ?? ""} rows={2} className="sm:col-span-2" />
      <Field label="Precio mensual (€)" name="monthlyPrice" defaultValue={centsToInput(plan?.monthlyPriceCents)} placeholder="Ej.: 29,00" hint="Vacío = sin opción mensual" />
      <Field label="Precio anual (€)" name="yearlyPrice" defaultValue={centsToInput(plan?.yearlyPriceCents)} placeholder="Ej.: 290,00" hint="Vacío = sin opción anual" />
      <TextArea label="Ventajas (una por línea)" name="benefits" defaultValue={plan?.benefits.join("\n")} rows={4} className="sm:col-span-2" hint="Se muestran en la página de membresías." />

      <div className="border-t border-silver-300/50 pt-4 sm:col-span-2"><p className="font-semibold">Contenidos incluidos</p></div>
      <div className="sm:col-span-2"><Checkbox label="Incluye TODO el catálogo (presente y futuro)" name="includesAllCourses" defaultChecked={plan?.includesAllCourses} /></div>
      <fieldset className="rounded-lg border border-silver-300/60 p-3">
        <legend className="px-1 text-sm font-medium">Categorías completas</legend>
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {categories.map((c) => <Checkbox key={c.id} label={c.name} name="categoryIds" value={c.id} defaultChecked={categoryIds.includes(c.id)} />)}
        </div>
        <p className="hint">Incluye los cursos actuales y futuros de la categoría.</p>
      </fieldset>
      <fieldset className="rounded-lg border border-silver-300/60 p-3">
        <legend className="px-1 text-sm font-medium">Cursos concretos</legend>
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {courses.length === 0 && <p className="text-xs text-silver-600">Aún no hay cursos.</p>}
          {courses.map((c) => <Checkbox key={c.id} label={c.name} name="courseIds" value={c.id} defaultChecked={courseIds.includes(c.id)} />)}
        </div>
      </fieldset>

      <div className="border-t border-silver-300/50 pt-4 sm:col-span-2"><p className="font-semibold">Permisos</p></div>
      <Checkbox label="Permite descargar materiales" name="allowDownloads" defaultChecked={plan?.allowDownloads ?? true} />
      <Checkbox label="Permite obtener certificados" name="allowCertificates" defaultChecked={plan?.allowCertificates ?? true} />
      <div className="sm:col-span-2 rounded-lg bg-snow p-3"><Checkbox label="Membresía a la venta" name="isActive" defaultChecked={plan?.isActive} hint="Visible en /membresias. Los suscriptores actuales mantienen su acceso aunque la desactives." /></div>
      <div className="sm:col-span-2"><Submit>{plan ? "Guardar membresía" : "Crear membresía"}</Submit></div>
    </Form>
  );
}
