// export { default } from "next-auth/middleware";

// /**
//  * Protege todas las rutas excepto:
//  * - /api/auth/*  (necesario para el flujo de login)
//  * - /login       (página de inicio de sesión)
//  * - /_next/*     (assets de Next.js)
//  * - /favicon.ico
//  */
// export const config = {
//   matcher: [
//     // "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
//   ],
// };

export function middleware() {}

export const config = {
  matcher: [],
};
