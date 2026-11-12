import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { Form, Submit, ActionButton } from "@/components/ui/Form";
import { Field, Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/StatusBadge";
import { grantAccessAction, revokeAccessAction, restoreAccessAction, issueCertificateManuallyAction } from "@/app/actions/admin/commerce";
import { updateUserAction, toggleDisableUserAction, sendResetLinkAction, resetProgressAction } from "@/app/actions/admin/users";
import { loadAccessProfile } from "@/lib/access-server";
import { studentCourses } from "@/lib/student";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      entitlements: { orderBy: { createdAt: "desc" }, include: { course: true, module: { include: { course: true } } } },
      orders: { orderBy: { createdAt: "desc" }, include: { items: true } },
      subscriptions: { orderBy: { createdAt: "desc" }, include: { plan: true } },
      certificates: { orderBy: { issuedAt: "desc" } },
      quizAttempts: { orderBy: { createdAt: "desc" }, take: 20, include: { quiz: { include: { lesson: true } } } },
    },
  });
  if (!user) notFound();
  const profile = await loadAccessProfile(user.id, "STUDENT");
  const progress = await studentCourses(user.id, profile);
  const courses = await db.course.findMany({ orderBy: { title: "asc" }, include: { modules: { orderBy: { sortOrder: "asc" } } } });
  const targets = courses.flatMap((c) => [{ value: `course:${c.id}`, label: `Curso: ${c.title}` }, ...c.modules.map((m) => ({ value: `module:${m.id}`, label: `  Módulo: ${m.title} (${c.title})` }))]);

  return (
    <>
      <PageHeader
        title={user.name}
        subtitle={<span className="flex flex-wrap items-center gap-2">{user.email} {user.emailVerifiedAt ? <Badge tone="green">Email verificado</Badge> : <Badge tone="amber">Sin verificar</Badge>} {user.disabledAt && <Badge tone="red">Desactivado</Badge>} · Alta {formatDate(user.createdAt)}</span>}
        back={{ href: "/admin/alumnos", label: "Alumnos" }}
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Progreso de aprendizaje">
            {progress.length === 0 ? <p className="text-sm text-silver-600">Sin cursos.</p> : (
              <ul className="space-y-3">
                {progress.map((p) => (
                  <li key={p.course.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{p.course.title}</span> <span className="text-xs text-silver-600">{p.full ? "completo" : `${p.ownedModules.length} módulo(s)`}</span>
                      <span className="mt-1 block h-1.5 max-w-sm overflow-hidden rounded-full bg-snow"><span className="block h-full bg-electric" style={{ width: `${p.percent}%` }} /></span>
                    </span>
                    <span className="text-xs">{p.percent}% · {p.completed}/{p.total}</span>
                    <ActionButton action={resetProgressAction} hidden={{ userId: user.id, courseId: p.course.id }} className="text-xs text-red-600 hover:underline" confirm="¿Reiniciar el progreso del alumno en este curso?">Reiniciar</ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Accesos a cursos y módulos">
            {user.entitlements.length > 0 && (
              <ul className="mb-5 divide-y divide-silver-300/40 rounded-lg border border-silver-300/50 text-sm">
                {user.entitlements.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {e.course ? `Curso: ${e.course.title}` : `Módulo: ${e.module?.title} (${e.module?.course.title})`}
                      <span className="ml-2 text-xs text-silver-600">{e.source === "PURCHASE" ? "Compra" : "Concedido"} · {formatDate(e.createdAt)}{e.expiresAt && ` · caduca ${formatDate(e.expiresAt)}`}</span>
                    </span>
                    {e.revokedAt ? (
                      <span className="flex items-center gap-2"><Badge tone="red">Revocado</Badge><ActionButton action={restoreAccessAction} hidden={{ id: e.id }}>Restaurar</ActionButton></span>
                    ) : (
                      <ActionButton action={revokeAccessAction} hidden={{ id: e.id }} className="btn-outline btn-sm text-red-600" confirm="¿Revocar este acceso?">Revocar</ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Form action={grantAccessAction} className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
              <input type="hidden" name="userId" value={user.id} />
              <Select label="Conceder acceso manual" name="target" options={[{ value: "", label: "Selecciona…" }, ...targets]} />
              <Field label="Días (0 = siempre)" name="days" type="number" min={0} defaultValue={0} />
              <Submit>Conceder</Submit>
            </Form>
          </Section>

          <Section title="Membresías">
            {user.subscriptions.length === 0 ? <p className="text-sm text-silver-600">Sin suscripciones.</p> : (
              <table className="table"><thead><tr><th>Plan</th><th>Periodicidad</th><th>Estado</th><th>Fin de periodo</th></tr></thead>
                <tbody>{user.subscriptions.map((s) => <tr key={s.id}><td>{s.plan.name}</td><td>{s.interval === "MONTH" ? "Mensual" : "Anual"}</td><td>{s.status}{s.cancelAtPeriodEnd && " (cancelará)"}</td><td>{formatDate(s.currentPeriodEnd)}</td></tr>)}</tbody>
              </table>
            )}
          </Section>

          <Section title="Compras">
            {user.orders.length === 0 ? <p className="text-sm text-silver-600">Sin compras.</p> : (
              <table className="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Estado</th></tr></thead>
                <tbody>{user.orders.map((o) => <tr key={o.id}><td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</td><td>{o.items.map((i) => i.description).join(", ")}</td><td>{formatPrice(o.totalCents, o.currency)}</td><td>{o.status}</td></tr>)}</tbody>
              </table>
            )}
          </Section>

          <Section title="Cuestionarios recientes">
            {user.quizAttempts.length === 0 ? <p className="text-sm text-silver-600">Sin intentos.</p> : (
              <table className="table"><thead><tr><th>Cuestionario</th><th>Nota</th><th>Fecha</th></tr></thead>
                <tbody>{user.quizAttempts.map((a) => <tr key={a.id}><td>{a.quiz.lesson.title}</td><td>{a.score}% {a.passed ? "✓" : ""}</td><td>{formatDateTime(a.createdAt)}</td></tr>)}</tbody>
              </table>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Cuenta">
            <Form action={updateUserAction}>
              <input type="hidden" name="id" value={user.id} />
              <Field label="Nombre" name="name" defaultValue={user.name} required />
              <Select label="Rol" name="role" defaultValue={user.role} options={[{ value: "STUDENT", label: "Alumno" }, { value: "EDITOR", label: "Editor de contenidos" }, { value: "ADMIN", label: "Administrador" }]} hint="Cambiar el rol cierra las sesiones del usuario." />
              <Submit>Guardar</Submit>
            </Form>
            <div className="mt-4 space-y-2 border-t border-silver-300/50 pt-4">
              <Form action={sendResetLinkAction} className="space-y-2"><input type="hidden" name="id" value={user.id} /><Submit className="btn-outline w-full">Enviar enlace para cambiar contraseña</Submit></Form>
              {user.id !== admin.id && (
                <ActionButton action={toggleDisableUserAction} hidden={{ id: user.id }} className={`btn w-full ${user.disabledAt ? "btn-outline" : "btn-danger"}`} confirm={user.disabledAt ? undefined : "¿Desactivar la cuenta? El usuario no podrá iniciar sesión."}>
                  {user.disabledAt ? "Reactivar cuenta" : "Desactivar cuenta"}
                </ActionButton>
              )}
            </div>
          </Section>
          <Section title="Certificados">
            {user.certificates.length > 0 && (
              <ul className="mb-4 space-y-1 text-sm">
                {user.certificates.map((c) => <li key={c.id}>{c.courseTitle} <span className="font-mono text-xs text-silver-600">{c.code}</span> {c.revokedAt && <Badge tone="red">Revocado</Badge>}</li>)}
              </ul>
            )}
            <Form action={issueCertificateManuallyAction}>
              <input type="hidden" name="userId" value={user.id} />
              <Select label="Emitir certificado manualmente" name="courseId" options={courses.map((c) => ({ value: c.id, label: c.title }))} />
              <Submit className="btn-outline">Emitir</Submit>
            </Form>
          </Section>
        </div>
      </div>
    </>
  );
}
