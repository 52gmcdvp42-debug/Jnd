import { requireUser } from "@/lib/auth/session";
import { AccountNav } from "@/components/AccountNav";
import { logoutAction, resendVerificationAction } from "@/app/actions/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/cuenta");
  return (
    <div className="container-x py-8 sm:py-12">
      {!user.emailVerifiedAt && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>Confirma tu email para proteger tu cuenta. Revisa tu bandeja de entrada.</span>
          <form action={resendVerificationAction}><button className="font-semibold underline">Reenviar email</button></form>
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside>
          <p className="text-sm text-silver-600">Hola,</p>
          <p className="truncate font-semibold">{user.name}</p>
          <AccountNav />
          <form action={logoutAction} className="mt-4 hidden lg:block">
            <button className="text-sm text-silver-600 hover:text-navy">Cerrar sesión</button>
          </form>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
