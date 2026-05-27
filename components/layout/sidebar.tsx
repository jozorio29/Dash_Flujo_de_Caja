"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
// import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Tags,
  CalendarRange,
  ListChecks,
  CalendarDays,
  TableProperties,
  Sheet,
  LogOut,
  PanelLeftClose,
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
  { href: "/ingresos", label: "Ingresos", icon: TrendingUp },
  { href: "/egresos", label: "Egresos", icon: TrendingDown },
  { href: "/categorias", label: "Categorías", icon: Tags },
  { href: "/diario", label: "Análisis Diario", icon: CalendarRange },
  { href: "/movimientos", label: "Detalle de Movimientos", icon: ListChecks },
];

export function Sidebar({ onHide }: { onHide: () => void }) {
  const pathname = usePathname();
  // const { data: session } = useSession();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800/40 bg-[#0B1B3B] text-slate-200 md:flex">
      <div className="flex h-24 items-center justify-between gap-3 px-5 pt-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f2f2f2] shadow-lg shadow-blue-900/40">
            <img
              src="/xtendo-logo.svg"
              alt="Xtendo"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-sm font-semibold text-white">Xtendo</div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Flujo de Caja
            </div>
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

      <nav className="flex-1 space-y-1 px-3 py-2">
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

      {/* <div className="m-3 rounded-xl bg-slate-900/40 p-3 text-xs ring-1 ring-white/5">
        {session?.user && (
          <>
            <div className="mb-2 flex items-center gap-2 text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="uppercase tracking-wider">Sesión</span>
            </div>
            <div className="mb-3 truncate text-sm font-semibold text-white" title={session.user.email ?? ""}>
              {session.user.name ?? session.user.email}
            </div>
          </>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10"
        >
          <LogOut className="h-3.5 w-3.5" />
          Cerrar sesión
        </button>
      </div> */}
    </aside>
  );
}
