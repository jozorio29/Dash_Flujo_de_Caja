"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sidebar } from "./sidebar";

/**
 * Shell que decide si renderizar el sidebar o no.
 * En la página de /login no queremos el sidebar (la página tiene su propio layout).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/login");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const saved = window.localStorage.getItem("xtendo-sidebar-open");
    if (saved !== null) {
      setSidebarOpen(saved === "true");
    }
  }, []);

  function toggleSidebar() {
    setSidebarOpen((open) => {
      const next = !open;
      window.localStorage.setItem("xtendo-sidebar-open", String(next));
      return next;
    });
  }

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {sidebarOpen ? <Sidebar /> : null}
      <div className="sticky top-0 hidden h-dvh w-5 shrink-0 md:block">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-full w-full items-center justify-center border-r border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-500"
          aria-label={sidebarOpen ? "Ocultar menú lateral" : "Mostrar menú lateral"}
          title={sidebarOpen ? "Ocultar menú lateral" : "Mostrar menú lateral"}
          aria-expanded={sidebarOpen}
          aria-controls={sidebarOpen ? "app-sidebar" : undefined}
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>
      <main className="min-w-0 flex-1 overflow-x-auto">
        {children}
      </main>
    </div>
  );
}
