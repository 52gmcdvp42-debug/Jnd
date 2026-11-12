import { hash, verify } from "@node-rs/argon2";

// Argon2id con parámetros recomendados por OWASP
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTS);
}

export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password);
  } catch {
    return false;
  }
}

// Hash ficticio para igualar tiempos cuando el usuario no existe
let dummy: string | null = null;
export async function dummyVerify(password: string) {
  dummy ??= await hashPassword("dummy-password-for-timing");
  await verifyPassword(dummy, password);
}
