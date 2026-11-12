"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";

type PlaybackResponse = { src: string; poster?: string; expiresAt: number; start: number; watermark: string | null; error?: string };

/**
 * Reproductor HLS con calidad adaptativa (hls.js; Safari/iOS usa HLS nativo).
 * - Pide al servidor una URL firmada y temporal (solo si el usuario tiene acceso).
 * - Reanuda en la posición guardada y envía el progreso cada 10 s, al pausar y al salir.
 * - Marca de agua dinámica con el email del alumno (disuasoria).
 */
export function VideoPlayer({ lessonId, trackProgress, onCompleted }: { lessonId: string; trackProgress: boolean; onCompleted?: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSent = useRef(0);
  const completedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [wmPos, setWmPos] = useState({ top: 12, left: 12 });

  const send = useCallback(
    (force = false) => {
      const v = videoRef.current;
      if (!trackProgress || !v || !Number.isFinite(v.currentTime)) return;
      const now = Date.now();
      if (!force && now - lastSent.current < 10_000) return;
      lastSent.current = now;
      const body = JSON.stringify({ position: v.currentTime, duration: Number.isFinite(v.duration) ? v.duration : null });
      if (force && navigator.sendBeacon) {
        navigator.sendBeacon(`/api/lessons/${lessonId}/progress`, new Blob([body], { type: "application/json" }));
        return;
      }
      fetch(`/api/lessons/${lessonId}/progress`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
        .then((r) => r.json())
        .then((d) => {
          if (d?.completed && !completedRef.current) {
            completedRef.current = true;
            onCompleted?.();
          }
        })
        .catch(() => {});
    },
    [lessonId, trackProgress, onCompleted],
  );

  const load = useCallback(
    async (resumeAt?: number) => {
      setError(null);
      const res = await fetch(`/api/lessons/${lessonId}/playback`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({ error: "error" }))) as PlaybackResponse;
      if (!res.ok || data.error) {
        setError(res.status === 403 ? "No tienes acceso a esta lección." : res.status === 401 ? "Inicia sesión para ver esta lección." : "El vídeo no está disponible en este momento.");
        return;
      }
      setWatermark(data.watermark);
      const v = videoRef.current!;
      const startAt = resumeAt ?? data.start;
      if (data.poster) v.poster = data.poster;
      hlsRef.current?.destroy();
      hlsRef.current = null;
      const isHls = /\.m3u8(\?|$)/.test(data.src) || data.src.includes(".m3u8");
      if (isHls && !v.canPlayType("application/vnd.apple.mpegurl")) {
        const { default: HlsLib } = await import("hls.js");
        if (HlsLib.isSupported()) {
          const hls = new HlsLib({ startPosition: startAt || -1, capLevelToPlayerSize: true });
          hls.loadSource(data.src);
          hls.attachMedia(v);
          hls.on(HlsLib.Events.ERROR, (_e, d) => {
            if (!d.fatal) return;
            if (d.type === HlsLib.ErrorTypes.NETWORK_ERROR && d.response?.code === 403) {
              void load(v.currentTime); // URL caducada → renovar
            } else if (d.type === HlsLib.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
            else setError("Error de reproducción. Recarga la página.");
          });
          hlsRef.current = hls;
          return;
        }
      }
      v.src = data.src;
      v.addEventListener("loadedmetadata", () => { if (startAt) v.currentTime = startAt; }, { once: true });
    },
    [lessonId],
  );

  useEffect(() => {
    void load();
    const onHide = () => send(true);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      send(true);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
      hlsRef.current?.destroy();
    };
  }, [load, send]);

  useEffect(() => {
    if (!watermark) return;
    const t = setInterval(() => setWmPos({ top: 8 + Math.random() * 75, left: 5 + Math.random() * 60 }), 20_000);
    return () => clearInterval(t);
  }, [watermark]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black" onContextMenu={(e) => e.preventDefault()}>
      <video
        ref={videoRef}
        className="h-full w-full"
        controls
        playsInline
        preload="metadata"
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onTimeUpdate={() => send()}
        onPause={() => send(true)}
        onEnded={() => send(true)}
        onError={() => {
          const v = videoRef.current;
          if (v && !hlsRef.current && v.error?.code === 2) void load(v.currentTime);
        }}
      />
      {watermark && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute select-none text-[11px] font-medium text-white/30 transition-all duration-1000"
          style={{ top: `${wmPos.top}%`, left: `${wmPos.left}%` }}
        >
          {watermark}
        </span>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy/90 p-6 text-center text-sm text-snow">{error}</div>
      )}
    </div>
  );
}
