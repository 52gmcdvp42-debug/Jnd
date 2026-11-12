import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth/session";
import { PageHeader, Section } from "@/components/admin/PageHeader";
import { VideoForm } from "@/components/admin/VideoForm";
import { ActionButton } from "@/components/ui/Form";
import { deleteVideoAction } from "@/app/actions/admin/content";
import { formatDuration } from "@/lib/format";
import { PROVIDER_LABEL } from "@/lib/video";

export const metadata = { title: "Vídeos" };

export default async function VideosPage() {
  await requireStaff();
  const videos = await db.video.findMany({ orderBy: { createdAt: "desc" }, include: { lessons: { select: { title: true } } } });
  return (
    <>
      <PageHeader title="Biblioteca de vídeos" subtitle="Los vídeos se alojan en Bunny Stream o Mux y se reproducen dentro de JND con enlaces firmados y temporales." />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          {videos.length === 0 && <div className="card p-8 text-center text-sm text-silver-600">La biblioteca está vacía. Sube el vídeo a tu proveedor y pega aquí su identificador.</div>}
          {videos.map((v) => (
            <details key={v.id} className="card">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-4 text-sm">
                <span className="font-medium">{v.title}</span>
                <span className="text-xs text-silver-600">{PROVIDER_LABEL[v.provider]} · {formatDuration(v.durationSeconds) || "duración no indicada"} · {v.lessons.length ? `en: ${v.lessons.map((l) => l.title).join(", ")}` : "sin usar"} ▾</span>
              </summary>
              <div className="border-t border-silver-300/50 p-4">
                <VideoForm video={v} />
                <div className="mt-3"><ActionButton action={deleteVideoAction} hidden={{ id: v.id }} className="text-sm text-red-600 hover:underline" confirm="¿Quitar este vídeo de la biblioteca? Las lecciones que lo usan se quedarán sin vídeo (no se borra del proveedor).">Quitar de la biblioteca</ActionButton></div>
              </div>
            </details>
          ))}
        </div>
        <div className="space-y-6">
          <Section title="Añadir vídeo"><VideoForm /></Section>
          <Section title="Cómo subir un vídeo">
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-navy-600">
              <li>Sube el vídeo en el panel de Bunny Stream (admite archivos de varias horas).</li>
              <li>Copia su «Video ID».</li>
              <li>Pégalo aquí o directamente en la lección.</li>
            </ol>
            <p className="mt-3 text-xs text-silver-600">Bunny convierte el vídeo a varias calidades (HLS adaptativo) automáticamente.</p>
          </Section>
        </div>
      </div>
    </>
  );
}
