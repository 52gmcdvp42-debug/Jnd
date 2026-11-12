import Link from "next/link";
import { getCurrentUser, isStaff } from "@/lib/auth/session";
import { Logo } from "@/components/Logo";
import { MobileMenu } from "@/components/MobileMenu";

const NAV = [
  { href: "/cursos", label: "Cursos" },
  { href: "/membresias", label: "Membresías" },
  { href: "/sobre-jnd", label: "Sobre JND" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-navy/95 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-silver-300 transition hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              {isStaff(user.role) && (
                <Link href="/admin" className="text-sm font-medium text-silver-300 hover:text-white">
                  Admin
                </Link>
              )}
              <Link href="/cuenta" className="btn-primary">
                Mi área
              </Link>
            </>
          ) : (
            <>
              <Link href="/entrar" className="text-sm font-medium text-silver-300 hover:text-white">
                Entrar
              </Link>
              <Link href="/registro" className="btn-primary">
                Crear cuenta
              </Link>
            </>
          )}
        </div>
        <MobileMenu nav={NAV} loggedIn={!!user} staff={!!user && isStaff(user.role)} />
      </div>
    </header>
  );
}
