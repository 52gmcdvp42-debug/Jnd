import Link from "next/link";
import { formatPrice, LEVEL_LABEL } from "@/lib/format";
import { publicFileUrl } from "@/lib/storage";
import type { Level } from "@prisma/client";

export type CourseCardData = {
  slug: string;
  title: string;
  subtitle: string | null;
  level: Level;
  priceCents: number | null;
  currency: string;
  coverImageKey: string | null;
  category: { name: string } | null;
  _count?: { modules: number };
};

export function CourseCard({ course, badge }: { course: CourseCardData; badge?: string }) {
  const cover = publicFileUrl(course.coverImageKey);
  return (
    <Link href={`/cursos/${course.slug}`} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-[16/9] overflow-hidden bg-navy">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="bg-grid flex h-full items-center justify-center">
            <span className="font-display text-3xl font-extrabold tracking-[0.3em] text-white/15">JND</span>
          </div>
        )}
        {badge && <span className="badge absolute left-3 top-3 bg-electric text-white">{badge}</span>}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow">{course.category?.name ?? "Formación"}</p>
        <h3 className="mt-2 text-lg font-semibold leading-snug">{course.title}</h3>
        {course.subtitle && <p className="mt-1 line-clamp-2 text-sm text-silver-600">{course.subtitle}</p>}
        <div className="mt-auto flex items-center justify-between pt-4 text-sm">
          <span className="text-silver-600">{LEVEL_LABEL[course.level]}</span>
          <span className="font-semibold">{course.priceCents ? formatPrice(course.priceCents, course.currency) : "Con membresía"}</span>
        </div>
      </div>
    </Link>
  );
}
