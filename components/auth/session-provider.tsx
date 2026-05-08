"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Wrapper client-side del SessionProvider de NextAuth.
 * Necesario porque el SessionProvider usa React Context y no puede
 * vivir directo en un Server Component (app/layout.tsx).
 */
export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
