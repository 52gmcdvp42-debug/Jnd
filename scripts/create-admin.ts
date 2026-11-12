/**
 * Crea (o promociona) un administrador.
 *   npm run create-admin -- --email tu@email.com --name "Tu Nombre"
 * La contraseña se pide por consola (no queda en el historial). También acepta ADMIN_PASSWORD.
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";
import { createInterface } from "node:readline/promises";

const db = new PrismaClient();
const arg = (k: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const email = arg("email")?.toLowerCase().trim();
  const name = arg("name") ?? "Administrador";
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Uso: npm run create-admin -- --email tu@email.com --name \"Nombre\"");
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    password = await rl.question("Contraseña (mín. 12 caracteres): ");
    rl.close();
  }
  if (!password || password.length < 12) throw new Error("La contraseña debe tener al menos 12 caracteres.");
  const passwordHash = await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const user = await db.user.upsert({
    where: { email },
    update: { role: "ADMIN", passwordHash, disabledAt: null },
    create: { email, name, passwordHash, role: "ADMIN", emailVerifiedAt: new Date() },
  });
  await db.session.deleteMany({ where: { userId: user.id } });
  console.log(`Administrador listo: ${user.email}`);
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
