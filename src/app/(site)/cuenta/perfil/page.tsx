import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { Form, Submit } from "@/components/ui/Form";
import { Field } from "@/components/ui/Field";
import { changePasswordAction, logoutOtherSessionsAction, updateProfileAction } from "@/app/actions/account";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Perfil" };

export default async function ProfilePage() {
  const user = await requireUser("/cuenta/perfil");
  const sessions = await db.session.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" } });
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Perfil y seguridad</h1>
      <section className="card p-6">
        <h2 className="font-semibold">Datos personales</h2>
        <Form action={updateProfileAction} className="mt-4 grid max-w-lg gap-4">
          <Field label="Nombre y apellidos" name="name" defaultValue={user.name} required hint="Es el nombre que aparecerá en tus certificados." />
          <Field label="Email" name="email" defaultValue={user.email} disabled hint="Para cambiar el email, contacta con soporte." />
          <div><Submit>Guardar</Submit></div>
        </Form>
      </section>
      <section className="card p-6">
        <h2 className="font-semibold">Cambiar contraseña</h2>
        <Form action={changePasswordAction} className="mt-4 grid max-w-lg gap-4" resetOnSuccess>
          <Field label="Contraseña actual" name="current" type="password" autoComplete="current-password" required />
          <Field label="Nueva contraseña" name="password" type="password" autoComplete="new-password" required minLength={10} hint="Mínimo 10 caracteres, con letras y números." />
          <div><Submit>Actualizar contraseña</Submit></div>
        </Form>
      </section>
      <section className="card p-6">
        <h2 className="font-semibold">Sesiones activas</h2>
        <ul className="mt-3 divide-y divide-silver-300/40 text-sm">
          {sessions.map((s) => (
            <li key={s.id} className="py-2">
              <span className="block truncate">{s.userAgent ?? "Dispositivo desconocido"}</span>
              <span className="text-xs text-silver-600">Último uso: {formatDateTime(s.lastUsedAt)}</span>
            </li>
          ))}
        </ul>
        {sessions.length > 1 && (
          <form action={logoutOtherSessionsAction} className="mt-3"><button className="btn-outline btn-sm">Cerrar las demás sesiones</button></form>
        )}
      </section>
    </div>
  );
}
