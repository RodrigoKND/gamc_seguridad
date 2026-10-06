'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  Map,
  Users,
  X,
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { ROLE_NAV_ROUTES } from '@/lib/permissions';
import type { UserRole } from '@/types/user';

// RF/RNF: Dashboard Shell — Grupo 4 (MASTER.md sección 7.3).
// Paleta Innova (MASTER.md sección 4): superficie PLANA primary-700 — el
// mismo lila de la barra lateral de Innova y del header de la app móvil.
// Sin degradado ni marca de agua (skill ui-ux-pro-max: "AI purple/pink
// gradients" es anti-patrón; estilo gubernamental "Accessible & Ethical").
// Ítem activo = píldora blanca con texto primary-900 (9.19:1) e ícono
// accent-600 (5.35:1); inactivos en white/85 (4.98:1 sobre primary-700).
// Foco: anillo blanco con offset del mismo lila (visible sobre la superficie).
// Árbol de navegación por rol — MASTER.md sección 7.2 (Opción A: los ítems
// fuera de alcance NO se renderizan, no se muestran deshabilitados). El
// filtrado usa lib/permissions.ts (ROLE_NAV_ROUTES) para no divergir nunca
// del middleware, que usa la misma fuente de verdad.
// Ancho: 260px expandido / 72px colapsado; <lg: drawer overlay con backdrop
// (MASTER.md sección 7.1).

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

// Registro maestro — el orden acá es el orden visual dentro de cada árbol
// de rol (ROLE_NAV_ROUTES filtra, no reordena).
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/credenciales', label: 'Generar Credenciales', icon: KeyRound },
  { href: '/mapas', label: 'Módulo de Mapas', icon: Map },
  { href: '/guardias', label: 'Guardias', icon: Users },
  { href: '/hechos', label: 'Reporte', icon: AlertTriangle },
];

export interface SidebarProps {
  role: UserRole;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  role,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const allowedRoutes = ROLE_NAV_ROUTES[role];
  const items = NAV_ITEMS.filter((item) => allowedRoutes.includes(item.href));

  return (
    <>
      {/* Backdrop móvil (<lg) — MASTER.md sección 7.1 */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-[1090] bg-black/40 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navegación principal"
        className={[
          'fixed inset-y-0 left-0 z-[1100] flex flex-col overflow-hidden bg-primary-700 transition-[transform,width] duration-200 ease-in-out',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px]',
          'w-[260px]',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center gap-3 border-b border-white/15 px-4 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 p-1 ring-1 ring-inset ring-white/25">
            <Logo size={28} />
          </span>
          {!isCollapsed && (
            <div className="min-w-0 animate-fade-in">
              <p className="truncate text-sm font-semibold text-white">GAMC</p>
              <p className="truncate text-xs text-white/85">Seguridad Ciudadana</p>
            </div>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
            className="ml-auto rounded-md p-1.5 text-white/85 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-700 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => {
            const isActive = pathname?.startsWith(item.href) ?? false;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                aria-current={isActive ? 'page' : undefined}
                title={isCollapsed ? item.label : undefined}
                onClick={onCloseMobile}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13.5px] font-medium',
                  'transition-colors duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-700',
                  isActive
                    ? 'bg-white font-semibold text-primary-900 shadow-sm'
                    : 'text-white/85 hover:bg-white/10 hover:text-white',
                ].join(' ')}
              >
                <Icon className={['h-5 w-5 shrink-0', isActive ? 'text-accent-600' : ''].join(' ')} aria-hidden="true" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/15 p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="hidden w-full items-center justify-center gap-2 rounded-lg p-2 text-xs font-medium text-white/85 transition-colors duration-200 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-700 lg:flex"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Colapsar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

// Nota: "loading", "empty" y "error" (MASTER.md sección 8) no aplican a este
// componente — el árbol de navegación es estático por rol (IA sección 7.2),
// no depende de datos remotos que puedan cargar, estar vacíos o fallar.