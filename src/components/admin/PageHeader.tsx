import Link from "next/link";

export function PageHeader({ title, subtitle, back, actions }: { title: string; subtitle?: React.ReactNode; back?: { href: string; label: string }; actions?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {back && <Link href={back.href} className="text-sm text-silver-600 hover:text-navy">← {back.label}</Link>}
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-silver-600">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Section({ title, description, children, className = "" }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      <h2 className="font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-silver-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Borrador (solo equipo)" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "HIDDEN", label: "Oculto" },
];
