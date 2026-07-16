import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Protege todas las rutas excepto:
 * - /api/auth/*   (flujo de login de NextAuth)
 * - /login        (página de inicio de sesión)
 * - /_next/*      (assets de Next.js)
 * - archivos estáticos (favicon, svg, png, etc.)
 *
 * Páginas sin sesión → redirect a /login.
 * APIs sin sesión → 401 JSON (evita que un fetch reciba HTML de login).
 */
export async function middleware(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set(
    "callbackUrl",
    req.nextUrl.pathname + req.nextUrl.search
  );
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)$).*)",
  ],
};
