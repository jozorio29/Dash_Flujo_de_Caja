"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";

/**
 * Shell que decide si renderizar el sidebar o no.
 * En la página de /login no queremos el sidebar (la página tiene su propio layout).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/login");

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
