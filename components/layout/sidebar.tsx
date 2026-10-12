"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Tags,
  CalendarRange,
  ListChecks,
  UserCircle,
  TableProperties,
  Sheet,
  FileSpreadsheet,
  LogOut,
  PanelLeftClose,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Resumen", icon: LayoutDashboard },
  { href: "/flujo-caja-real", label: "Flujo de Caja", icon: Sheet },
  {
    href: "/flujo-mensual",
    label: "Flujo de Caja Proyectado",
    icon: TableProperties,
  },
  {
    href: "/estado-resultados",
    label: "Estado de Resultados",
    icon: FileSpreadsheet,
  },
  { href: "/facturacion", label: "Facturación", icon: TrendingUp },
  { href: "/egresos", label: "Egresos", icon: TrendingDown },
  { href: "/categorias", label: "Categorías", icon: Tags },
  { href: "/diario", label: "Análisis Diario", icon: CalendarRange },
  { href: "/movimientos", label: "Detalle de Movimientos", icon: ListChecks },
];

export function Sidebar({ onHide }: { onHide: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
    }
  }, []);

  const toggleTheme = () => {
    if (theme === "light") {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
      localStorage.setItem("theme", "dark");
      setTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
      localStorage.setItem("theme", "light");
      setTheme("light");
    }
  };

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-hidden border-r border-slate-800/40 bg-[#0B1B3B] text-slate-200 md:flex">
      <div className="flex h-24 shrink-0 items-center justify-between gap-3 px-5 pt-2">
        <div className="min-w-0 flex-1">
          <div className="w-full">
            <img
              src="/xtendo-logo-dark.png"
              alt="Xtendo"
              width={3133}
              height={976}
              className="h-auto w-full object-contain"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={onHide}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Ocultar menú lateral"
          title="Ocultar menú lateral"
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2">
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-blue-600/15 text-blue-200 ring-1 ring-blue-500/40"
                  : "text-slate-300 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active
                    ? "text-blue-300"
                    : "text-slate-400 group-hover:text-slate-200",
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 shrink-0 rounded-xl bg-slate-900/40 p-3 text-xs ring-1 ring-white/5">
        {session?.user && (
            <div
              className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"
              title={session.user.email ?? ""}
            >
              {session.user.image && failedImage !== session.user.image ? (
                <img
                  src={session.user.image}
                  alt="Foto de perfil"
                  width={32}
                  height={32}
                  referrerPolicy="no-referrer"
                  onError={() => setFailedImage(session?.user?.image ?? null)}
                  className="h-8 w-8 shrink-0 rounded-full object-cover"
                />
              ) : (
                <UserCircle className="h-8 w-8 shrink-0 text-slate-400" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-normal text-slate-400">Usuario</div>
                <div className="truncate">
                  {session.user.name?.split("@")[0].trim() || "Usuario"}
                </div>
              </div>
            </div>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
        >
          {theme === "dark" ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Moon className="h-3.5 w-3.5" />
          )}
          {theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-rose-500/20 hover:text-rose-200"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
