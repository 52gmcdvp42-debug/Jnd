import "server-only";
import { createHash, createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import type { VideoProvider } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Proveedores de vídeo. Los vídeos se alojan fuera (Bunny Stream o Mux), se reproducen
 * dentro de JND con un reproductor HLS (calidad adaptativa) y SIEMPRE con URLs firmadas
 * de corta duración que solo se entregan a usuarios autorizados.
 */

export const PLAYBACK_TTL_SECONDS = 4 * 3600; // cubre vídeos largos con pausas; el reproductor renueva al caducar

export type Playback = { src: string; poster?: string; expiresAt: number; protected: boolean };

function b64url(buf: Buffer) {
  return buf.toString("base64").replace(/\n/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Bunny CDN – autenticación por token (modo directorio) para que la lista HLS y
 * todos sus segmentos queden firmados con un solo token.
 * Requiere activar "Token Authentication" en la Pull Zone de la librería de Stream.
 */
export function signBunnyUrl(opts: { host: string; tokenKey: string; videoId: string; expires: number; file?: string }) {
  const dir = `/${opts.videoId}/`;
  const path = `${dir}${opts.file ?? "playlist.m3u8"}`;
  const params = `token_path=${dir}`;
  const token = b64url(createHash("sha256").update(opts.tokenKey + dir + opts.expires + params).digest());
  return `https://${opts.host}/bcdn_token=${token}&token_path=${encodeURIComponent(dir)}&expires=${opts.expires}${path}`;
}

/** Mux – reproducción firmada (JWT RS256). Requiere playback policy "signed". */
export async function signMuxToken(opts: { playbackId: string; keyId: string; privateKeyB64: string; aud: "v" | "t"; expires: number }) {
  const pem = Buffer.from(opts.privateKeyB64, "base64").toString("utf8");
  const key = createPrivateKey(pem.includes("BEGIN") ? pem : opts.privateKeyB64);
  return new SignJWT({ sub: opts.playbackId, aud: opts.aud, exp: opts.expires, kid: opts.keyId })
    .setProtectedHeader({ alg: "RS256", kid: opts.keyId })
    .sign(key);
}

export async function getPlayback(provider: VideoProvider, providerVideoId: string): Promise<Playback> {
  const expiresAt = Math.floor(Date.now() / 1000) + PLAYBACK_TTL_SECONDS;
  switch (provider) {
    case "BUNNY": {
      const { cdnHost, tokenKey } = env.bunny;
      if (!cdnHost) throw new Error("Bunny Stream no está configurado (BUNNY_STREAM_CDN_HOST)");
      if (!tokenKey) {
        if (env.isProd) throw new Error("BUNNY_STREAM_TOKEN_KEY es obligatorio en producción");
        return { src: `https://${cdnHost}/${providerVideoId}/playlist.m3u8`, expiresAt, protected: false };
      }
      return {
        src: signBunnyUrl({ host: cdnHost, tokenKey, videoId: providerVideoId, expires: expiresAt }),
        poster: signBunnyUrl({ host: cdnHost, tokenKey, videoId: providerVideoId, expires: expiresAt, file: "thumbnail.jpg" }),
        expiresAt,
        protected: true,
      };
    }
    case "MUX": {
      const { signingKeyId, signingPrivateKey } = env.mux;
      if (!signingKeyId || !signingPrivateKey) {
        if (env.isProd) throw new Error("Las claves de firma de Mux son obligatorias en producción");
        return { src: `https://stream.mux.com/${providerVideoId}.m3u8`, expiresAt, protected: false };
      }
      const [v, t] = await Promise.all([
        signMuxToken({ playbackId: providerVideoId, keyId: signingKeyId, privateKeyB64: signingPrivateKey, aud: "v", expires: expiresAt }),
        signMuxToken({ playbackId: providerVideoId, keyId: signingKeyId, privateKeyB64: signingPrivateKey, aud: "t", expires: expiresAt }),
      ]);
      return {
        src: `https://stream.mux.com/${providerVideoId}.m3u8?token=${v}`,
        poster: `https://image.mux.com/${providerVideoId}/thumbnail.jpg?token=${t}`,
        expiresAt,
        protected: true,
      };
    }
    case "URL":
      // Enlace directo: útil para pruebas. No ofrece protección por token.
      return { src: providerVideoId, expiresAt, protected: false };
  }
}

export const PROVIDER_LABEL: Record<VideoProvider, string> = {
  BUNNY: "Bunny Stream",
  MUX: "Mux",
  URL: "Enlace directo (HLS/MP4)",
};
