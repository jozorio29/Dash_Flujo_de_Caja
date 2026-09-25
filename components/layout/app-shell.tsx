"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PanelLeftOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

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
      {sidebarOpen ? <Sidebar onHide={toggleSidebar} /> : null}
      {!sidebarOpen ? (
        <button
          type="button"
          onClick={toggleSidebar}
          className="fixed left-4 top-4 z-40 hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-md transition-colors hover:bg-slate-100 hover:text-slate-950 md:flex"
          aria-label="Mostrar menú lateral"
          title="Mostrar menú lateral"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
      ) : null}
      <main className={cn("flex-1 overflow-x-auto", !sidebarOpen && "md:pt-10")}>
        {children}
      </main>
      <div className="fixed bottom-4 right-4 z-40">
        <ThemeToggle />
      </div>
    </div>
  );
}
