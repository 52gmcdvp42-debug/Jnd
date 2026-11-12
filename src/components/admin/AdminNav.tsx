"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const CONTENT = [
  { href: "/admin", label: "Resumen", exact: true },
  { href: "/admin/categorias", label: "Categorías" },
  { href: "/admin/cursos", label: "Cursos" },
  { href: "/admin/videos", label: "Vídeos" },
];
const BUSINESS = [
  { href: "/admin/membresias", label: "Membresías" },
  { href: "/admin/alumnos", label: "Alumnos" },
  { href: "/admin/compras", label: "Compras" },
  { href: "/admin/certificados", label: "Certificados" },
  { href: "/admin/ajustes", label: "Ajustes" },
  { href: "/admin/registro", label: "Registro de actividad" },
];

export function AdminNav({ role }: { role: string }) {
  const path = usePathname();
  const item = (i: { href: string; label: string; exact?: boolean }) => {
    const active = i.exact ? path === i.href : path.startsWith(i.href);
    return (
      <Link key={i.href} href={i.href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-electric text-white" : "text-silver-300 hover:bg-white/5 hover:text-white"}`}>
        {i.label}
      </Link>
    );
  };
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-6">
      <p className="hidden px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-silver lg:block">Contenidos</p>
      {CONTENT.map(item)}
      {role === "ADMIN" && (
        <>
          <p className="hidden px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-widest text-silver lg:block">Negocio</p>
          {BUSINESS.map(item)}
        </>
      )}
    </nav>
  );
}
