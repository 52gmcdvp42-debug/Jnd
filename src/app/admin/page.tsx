import Link from "next/link";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { formatDateTime, formatPrice } from "@/lib/format";
import { stripeEnabled } from "@/lib/stripe";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/admin/PageHeader";

export default async function AdminHome() {
  const user = await requireStaff();
  const since = new Date(Date.now() - 30 * 86400_000);
  const [students, newStudents, courses, published, activeSubs, revenue, orders, videos] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STUDENT", createdAt: { gt: since } } }),
    db.course.count(),
    db.course.count({ where: { status: "PUBLISHED" } }),
    db.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } } }),
    db.order.aggregate({ where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] }, paidAt: { gt: since } }, _sum: { totalCents: true, refundedCents: true } }),
    user.role === "ADMIN" ? db.order.findMany({ where: { status: { not: "PENDING" } }, take: 8, orderBy: { createdAt: "desc" }, include: { user: true, items: true } }) : [],
    db.video.count(),
  ]);
  const checks = [
    { ok: stripeEnabled(), label: "Pagos (Stripe)", hint: "Añade STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET" },
    { ok: !!(env.bunny.cdnHost && env.bunny.tokenKey) || !!(env.mux.signingKeyId && env.mux.signingPrivateKey), label: "Vídeo protegido (Bunny o Mux)", hint: "Configura las claves de firma del proveedor de vídeo" },
    { ok: env.storage.driver === "s3", label: "Almacenamiento en la nube (S3/R2)", hint: "En desarrollo se usa el disco local" },
    { ok: env.email.driver === "resend" && !!env.email.resendApiKey, label: "Correo electrónico (Resend)", hint: "En desarrollo los emails se muestran en consola" },
  ];
  const stats = [
    ["Alumnos", students, `+${newStudents} en 30 días`],
    ["Cursos", courses, `${published} publicados`],
    ["Membresías activas", activeSubs, ""],
    ["Ingresos 30 días", formatPrice((revenue._sum.totalCents ?? 0) - (revenue._sum.refundedCents ?? 0)), "compras individuales"],
  ] as const;

  return (
    <>
      <PageHeader title="Resumen" subtitle={`Hola, ${user.name}.`} actions={<Link href="/admin/cursos" className="btn-primary">Gestionar cursos</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value, hint]) => (
          <div key={label} className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-silver-600">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold">{value}</p>
            {hint && <p className="mt-1 text-xs text-silver-600">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">Estado de la plataforma</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                <span className={c.ok ? "text-emerald-600" : "text-amber-600"}>{c.ok ? "●" : "○"}</span>
                <span><span className="font-medium">{c.label}</span>{!c.ok && <span className="block text-xs text-silver-600">{c.hint}</span>}</span>
              </li>
            ))}
            <li className="flex items-start gap-2"><span className="text-silver">●</span><span>{videos} vídeos en la biblioteca</span></li>
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="font-semibold">Primeros pasos</h2>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-navy-600">
            <li>Revisa las <Link className="text-electric underline" href="/admin/categorias">categorías</Link>.</li>
            <li>Crea un <Link className="text-electric underline" href="/admin/cursos">curso</Link> (nace como borrador).</li>
            <li>Añade módulos y lecciones; enlaza los vídeos desde la <Link className="text-electric underline" href="/admin/videos">biblioteca</Link>.</li>
            <li>Fija precios del curso y/o de cada módulo.</li>
            {user.role === "ADMIN" && <li>Configura las <Link className="text-electric underline" href="/admin/membresias">membresías</Link> Esencial y Completa.</li>}
            <li>Publica cuando todo esté listo.</li>
          </ol>
        </section>
      </div>

      {user.role === "ADMIN" && (
        <section className="card mt-6 overflow-x-auto p-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Últimas compras</h2><Link href="/admin/compras" className="text-sm text-electric">Ver todas</Link></div>
          {orders.length === 0 ? <p className="mt-3 text-sm text-silver-600">Todavía no hay compras.</p> : (
            <table className="table mt-3">
              <thead><tr><th>Fecha</th><th>Alumno</th><th>Concepto</th><th>Importe</th><th>Estado</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}><td className="whitespace-nowrap">{formatDateTime(o.createdAt)}</td><td>{o.user.email}</td><td>{o.items.map((i) => i.description).join(", ")}</td><td>{formatPrice(o.totalCents, o.currency)}</td><td>{o.status}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
