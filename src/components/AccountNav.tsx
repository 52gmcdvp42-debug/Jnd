"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/cuenta", label: "Mis cursos" },
  { href: "/cuenta/cuestionarios", label: "Resultados" },
  { href: "/cuenta/certificados", label: "Certificados" },
  { href: "/cuenta/materiales", label: "Materiales" },
  { href: "/cuenta/suscripcion", label: "Membresía" },
  { href: "/cuenta/compras", label: "Compras" },
  { href: "/cuenta/perfil", label: "Perfil y seguridad" },
];

export function AccountNav() {
  const path = usePathname();
  return (
    <nav className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:px-0">
      {ITEMS.map((i) => {
        const active = i.href === "/cuenta" ? path === "/cuenta" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-navy text-snow" : "text-navy-600 hover:bg-white"}`}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
