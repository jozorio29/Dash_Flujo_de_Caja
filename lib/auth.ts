import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { verifyPassword } from "./password";

/**
 * Lista de emails autorizados (separados por coma en la variable de entorno).
 * Ej: ALLOWED_EMAILS=externo@gmail.com,otro@empresa.com
 */
function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Dominios cuyos usuarios entran automáticamente (separados por coma).
 * Ej: ALLOWED_DOMAINS=xtendo.global
 */
function getAllowedDomains(): string[] {
  return (process.env.ALLOWED_DOMAINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

/**
 * Usuarios con contraseña propia (administrados por el admin, NO son
 * contraseñas de Google). Formato en la variable de entorno:
 *   DASHBOARD_USERS=email1:scrypt$salt$hash,email2:scrypt$salt$hash
 * El hash se genera con: node scripts/hash-password.mjs "contraseña"
 */
function getCredentialUsers(): Map<string, string> {
  const users = new Map<string, string>();
  (process.env.DASHBOARD_USERS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const idx = pair.indexOf(":");
      if (idx > 0) {
        users.set(pair.slice(0, idx).toLowerCase(), pair.slice(idx + 1));
      }
    });
  return users;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email y contraseña",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const email = (credentials?.email || "").trim().toLowerCase();
        const password = credentials?.password || "";
        if (!email || !password) return null;

        const storedHash = getCredentialUsers().get(email);
        if (!storedHash) {
          console.warn("[auth] Credentials: email no registrado:", email);
          return null;
        }
        if (!verifyPassword(password, storedHash)) {
          console.warn("[auth] Credentials: contraseña incorrecta:", email);
          return null;
        }
        return { id: email, email, name: email.split("@")[0] };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Los usuarios de email/contraseña ya fueron validados en authorize()
      // contra DASHBOARD_USERS (estar en esa lista ES la autorización).
      if (account?.provider === "credentials") return true;
      const email = (user.email || "").toLowerCase();
      const domain = email.split("@")[1] || "";

      // Google incluye email_verified en el perfil; rechaza emails no verificados.
      const emailVerified = (profile as { email_verified?: boolean } | undefined)
        ?.email_verified;
      if (emailVerified === false) {
        console.warn("[auth] Login rechazado, email no verificado:", email);
        return false;
      }

      const allowedEmails = getAllowedEmails();
      const allowedDomains = getAllowedDomains();

      // Fail-safe: sin configuración, se rechaza todo.
      if (allowedEmails.length === 0 && allowedDomains.length === 0) {
        console.warn(
          "[auth] ALLOWED_EMAILS/ALLOWED_DOMAINS no configuradas. Rechazando login de",
          email
        );
        return false;
      }

      const ok =
        allowedDomains.includes(domain) || allowedEmails.includes(email);
      if (!ok)
        console.warn("[auth] Login rechazado para email no autorizado:", email);
      return ok;
    },
    async session({ session, token }) {
      // Pasa el email del token a la sesión (por si lo queremos mostrar en UI)
      if (session.user && token.email) {
        session.user.email = token.email;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", // si falla el signIn, redirige a /login con ?error=
  },
  session: { strategy: "jwt" },
};
