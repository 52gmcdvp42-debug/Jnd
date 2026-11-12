import "server-only";

function read(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

export const env = {
  get isProd() { return process.env.NODE_ENV === "production"; },
  get appUrl() { return read("APP_URL", "http://localhost:3000").replace(/\/$/, ""); },
  get appSecret() {
    const s = read("APP_SECRET");
    if (!s || s.length < 32) {
      if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET debe tener al menos 32 caracteres");
      return "dev-only-secret-change-me-0123456789abcdef";
    }
    return s;
  },
  stripe: {
    get secretKey() { return read("STRIPE_SECRET_KEY"); },
    get webhookSecret() { return read("STRIPE_WEBHOOK_SECRET"); },
  },
  bunny: {
    get libraryId() { return read("BUNNY_STREAM_LIBRARY_ID"); },
    get cdnHost() { return read("BUNNY_STREAM_CDN_HOST"); },
    get tokenKey() { return read("BUNNY_STREAM_TOKEN_KEY"); },
    get apiKey() { return read("BUNNY_STREAM_API_KEY"); },
  },
  mux: {
    get signingKeyId() { return read("MUX_SIGNING_KEY_ID"); },
    get signingPrivateKey() { return read("MUX_SIGNING_PRIVATE_KEY"); },
  },
  storage: {
    get driver() { return read("STORAGE_DRIVER", "local") as "local" | "s3"; },
    get localDir() { return read("STORAGE_LOCAL_DIR", "./storage"); },
    get s3Endpoint() { return read("S3_ENDPOINT"); },
    get s3Region() { return read("S3_REGION", "auto"); },
    get s3Bucket() { return read("S3_BUCKET"); },
    get s3AccessKeyId() { return read("S3_ACCESS_KEY_ID"); },
    get s3SecretAccessKey() { return read("S3_SECRET_ACCESS_KEY"); },
    get s3PublicBaseUrl() { return read("S3_PUBLIC_BASE_URL"); },
  },
  email: {
    get driver() { return read("EMAIL_DRIVER", "console") as "console" | "resend"; },
    get from() { return read("EMAIL_FROM", "JND <no-reply@example.com>"); },
    get resendApiKey() { return read("RESEND_API_KEY"); },
  },
};
