import type { Video } from "@prisma/client";
import { Form, Submit } from "@/components/ui/Form";
import { Field, Select } from "@/components/ui/Field";
import { saveVideoAction } from "@/app/actions/admin/content";

export function VideoForm({ video, attachToLesson }: { video?: Video; attachToLesson?: string }) {
  return (
    <Form action={saveVideoAction} resetOnSuccess={!video}>
      {video && <input type="hidden" name="id" value={video.id} />}
      {attachToLesson && <input type="hidden" name="attachToLesson" value={attachToLesson} />}
      <Field label="Título interno" name="title" defaultValue={video?.title} required />
      <Select
        label="Proveedor"
        name="provider"
        defaultValue={video?.provider ?? "BUNNY"}
        options={[
          { value: "BUNNY", label: "Bunny Stream (recomendado)" },
          { value: "MUX", label: "Mux" },
          { value: "URL", label: "Enlace directo HLS/MP4 (sin protección)" },
        ]}
      />
      <Field
        label="ID del vídeo / URL"
        name="providerVideoId"
        defaultValue={video?.providerVideoId}
        required
        hint="Bunny: el «Video ID» (GUID). Mux: el «Playback ID» firmado. Enlace directo: URL https://…"
      />
      <Field label="Duración (minutos)" name="durationMinutes" inputMode="decimal" defaultValue={video?.durationSeconds ? String(Math.round(video.durationSeconds / 6) / 10) : ""} placeholder="Ej.: 90" />
      <Submit>{video ? "Guardar vídeo" : "Añadir vídeo"}</Submit>
    </Form>
  );
}
