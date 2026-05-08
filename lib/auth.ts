import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

/**
 * Lista de emails autorizados (separados por coma en la variable de entorno).
 * Si la variable está vacía o no definida, se RECHAZAN todos los logins por seguridad.
 */
function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowed = getAllowedEmails();
      const email = (user.email || "").toLowerCase();

      // Si no hay allowlist configurada, RECHAZA todo (fail-safe).
      if (allowed.length === 0) {
        console.warn(
          "[auth] ALLOWED_EMAILS no está configurada. Rechazando login de",
          email
        );
        return false;
      }
      const ok = allowed.includes(email);
      if (!ok) console.warn("[auth] Login rechazado para email no autorizado:", email);
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
