import type { ContentStatus } from "@prisma/client";
import { STATUS_LABEL } from "@/lib/format";

const STYLES: Record<ContentStatus, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  PUBLISHED: "bg-emerald-100 text-emerald-800",
  HIDDEN: "bg-slate-200 text-slate-700",
};

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`badge ${STYLES[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "green" | "red" | "amber" }) {
  const t = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-electric-100 text-electric-600",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-800",
  }[tone];
  return <span className={`badge ${t}`}>{children}</span>;
}
