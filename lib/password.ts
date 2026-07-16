import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEYLEN = 64;

/**
 * Genera un hash con formato: scrypt$<salt>$<hash>
 * (usado por scripts/hash-password.mjs)
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

/**
 * Verifica una contraseña contra un hash `scrypt$salt$hash`
 * usando comparación en tiempo constante.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  try {
    const candidate = scryptSync(password, salt, KEYLEN);
    const expected = Buffer.from(hash, "hex");
    return (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    );
  } catch {
    return false;
  }
}
