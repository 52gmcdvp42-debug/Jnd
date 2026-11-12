import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { randomToken } from "@/lib/crypto";

/**
 * Almacenamiento de archivos.
 *  - "private/..." → materiales de alumnos. Nunca accesibles por URL pública.
 *  - "public/..."  → portadas e imágenes del catálogo.
 * Driver local (desarrollo) o S3 compatible (Cloudflare R2, AWS S3, Backblaze B2…).
 */

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

let s3: S3Client | null = null;
function client() {
  s3 ??= new S3Client({
    region: env.storage.s3Region,
    endpoint: env.storage.s3Endpoint || undefined,
    credentials: { accessKeyId: env.storage.s3AccessKeyId, secretAccessKey: env.storage.s3SecretAccessKey },
  });
  return s3;
}

function localPath(key: string) {
  const base = path.resolve(env.storage.localDir);
  const full = path.resolve(base, key);
  if (!full.startsWith(base + path.sep)) throw new Error("Ruta de almacenamiento no válida");
  return full;
}

function safeName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").slice(-120) || "archivo";
}

export function makeKey(visibility: "private" | "public", folder: string, fileName: string) {
  return `${visibility}/${folder}/${randomToken(12)}-${safeName(fileName)}`;
}

export async function putFile(key: string, data: Buffer, contentType: string) {
  if (env.storage.driver === "s3") {
    await client().send(new PutObjectCommand({ Bucket: env.storage.s3Bucket, Key: key, Body: data, ContentType: contentType }));
    return;
  }
  const p = localPath(key);
  await mkdir(path.dirname(p), { recursive: true });
  await writeFile(p, data);
}

export async function deleteFile(key: string) {
  try {
    if (env.storage.driver === "s3") await client().send(new DeleteObjectCommand({ Bucket: env.storage.s3Bucket, Key: key }));
    else await unlink(localPath(key));
  } catch (e) {
    console.warn("deleteFile", key, e);
  }
}

/** URL de descarga temporal (S3) o null si hay que servirlo desde el servidor (local). */
export async function signedDownloadUrl(key: string, fileName: string, seconds = 60): Promise<string | null> {
  if (env.storage.driver !== "s3") return null;
  return getSignedUrl(
    client(),
    new GetObjectCommand({
      Bucket: env.storage.s3Bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${safeName(fileName)}"`,
    }),
    { expiresIn: seconds },
  );
}

export async function readLocalStream(key: string): Promise<{ stream: ReadableStream; size: number } | null> {
  try {
    const p = localPath(key);
    const s = await stat(p);
    return { stream: Readable.toWeb(createReadStream(p)) as ReadableStream, size: s.size };
  } catch {
    return null;
  }
}

export function publicFileUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (!key.startsWith("public/")) return null;
  if (env.storage.driver === "s3" && env.storage.s3PublicBaseUrl) return `${env.storage.s3PublicBaseUrl.replace(/\/$/, "")}/${key}`;
  return `/api/files/${key}`;
}
