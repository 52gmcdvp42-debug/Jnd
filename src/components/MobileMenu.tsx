"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function MobileMenu({ nav, loggedIn, staff }: { nav: { href: string; label: string }[]; loggedIn: boolean; staff: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-lg p-2 text-snow hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 border-b border-white/10 bg-navy px-4 pb-6 pt-2 shadow-xl">
          <nav className="flex flex-col">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="border-b border-white/5 py-3 text-base text-snow">
                {n.label}
              </Link>
            ))}
            {staff && (
              <Link href="/admin" className="border-b border-white/5 py-3 text-base text-snow">
                Panel de administración
              </Link>
            )}
          </nav>
          <div className="mt-4 grid gap-2">
            {loggedIn ? (
              <Link href="/cuenta" className="btn-primary">
                Mi área
              </Link>
            ) : (
              <>
                <Link href="/registro" className="btn-primary">
                  Crear cuenta
                </Link>
                <Link href="/entrar" className="btn-ghost-light">
                  Entrar
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
