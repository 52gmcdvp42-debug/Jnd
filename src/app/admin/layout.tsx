import Link from "next/link";
import { requireStaff } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";
import { AdminNav } from "@/components/admin/AdminNav";
import { logoutAction } from "@/app/actions/auth";

export const metadata = { title: { default: "Administración", template: "%s · Admin JND" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <div className="min-h-screen lg:flex">
      <aside className="bg-navy text-snow lg:fixed lg:inset-y-0 lg:w-60 lg:overflow-y-auto">
        <div className="flex items-center justify-between p-4 lg:block lg:p-5">
          <Link href="/admin" className="flex items-center gap-2"><Logo /><span className="text-xs text-silver">Admin</span></Link>
          <Link href="/" className="text-xs text-silver hover:text-white lg:mt-3 lg:block">Ver web →</Link>
        </div>
        <AdminNav role={user.role} />
        <div className="hidden border-t border-white/10 p-5 text-xs text-silver lg:block">
          <p className="truncate">{user.email}</p>
          <p>{user.role === "ADMIN" ? "Administrador" : "Editor de contenidos"}</p>
          <form action={logoutAction} className="mt-2"><button className="hover:text-white">Cerrar sesión</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 lg:ml-60">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
