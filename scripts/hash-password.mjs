// Genera el hash de una contraseña para DASHBOARD_USERS.
// Uso: node scripts/hash-password.mjs "MiContraseñaSegura"
import { randomBytes, scryptSync } from "crypto";

const pwd = process.argv[2];
if (!pwd) {
  console.error('Uso: node scripts/hash-password.mjs "contraseña"');
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(pwd, salt, 64).toString("hex");
console.log(`scrypt$${salt}$${hash}`);
console.log(
  "\nAgrega a DASHBOARD_USERS como:  email@dominio.com:" +
    `scrypt$${salt}$${hash}`
);
