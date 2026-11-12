import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

const E2E_DB = "postgresql://postgres:postgres@localhost:5432/jnd_e2e";

/** Prepara la base de datos DESECHABLE de pruebas E2E (solo local, solo jnd_e2e). */
export default function globalSetup() {
  const url = new URL(E2E_DB);
  if (url.hostname !== "localhost" || url.pathname !== "/jnd_e2e") throw new Error("La limpieza E2E solo se permite sobre localhost/jnd_e2e");
  const env = { ...process.env, DATABASE_URL: E2E_DB };
  execSync(`psql "${E2E_DB}" -q -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"`, { stdio: "ignore" });
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });
  execSync("npx tsx prisma/seed.ts", { env, stdio: "ignore" });
  execSync('npx tsx scripts/create-admin.ts --email admin@e2e.local --name "Admin E2E"', { env: { ...env, ADMIN_PASSWORD: "AdminE2E-Password1" }, stdio: "ignore" });
  rmSync(".e2e-storage", { recursive: true, force: true });
}
