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
// Migrado a la paleta 2026 (brand-ink/brand-gold, MASTER.md sección 4) el
// 2026-09-06 — mismos motivos de identidad del Login (marca de agua de
// escudo, acento dorado en el ítem activo).
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
          'fixed inset-y-0 left-0 z-[1100] flex flex-col overflow-hidden bg-gradient-to-b from-brand-ink-900 to-brand-ink-950 transition-[transform,width] duration-200 ease-in-out',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          isCollapsed ? 'lg:w-[72px]' : 'lg:w-[260px]',
          'w-[260px]',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Marca de agua institucional — nuestro logo real, mismo motivo del Login */}
        <img
          src="/logo-gamc.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -right-16 z-0 h-64 w-64 object-contain opacity-[0.14] blur-[1px] [mask-image:radial-gradient(circle_at_center,black_35%,transparent_75%)]"
        />

        <div className="relative flex items-center gap-3 px-4 py-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-[1.5px] border-brand-gold-500 bg-white/5 p-1">
            <Logo size={26} />
          </span>
          {!isCollapsed && (
            <div className="min-w-0 animate-fade-in">
              <p className="truncate text-sm font-semibold text-white">GAMC</p>
              <p className="truncate text-xs text-white/60">Seguridad Ciudadana</p>
            </div>
          )}
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
            className="ml-auto rounded-md p-1 text-white/70 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="relative z-10 flex-1 space-y-1 overflow-y-auto px-3 py-2">
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
                  'flex items-center gap-3 rounded-r-md rounded-l-sm border-l-[3px] px-3 py-2.5 text-[13.5px] font-medium',
                  'transition-colors duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2',
                  isActive
                    ? 'border-brand-gold-500 bg-gradient-to-r from-brand-gold-500/[0.14] to-transparent text-white'
                    : 'border-transparent text-white/70 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <Icon className={['h-5 w-5 shrink-0', isActive ? 'text-brand-gold-500' : ''].join(' ')} aria-hidden="true" />
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="relative z-10 border-t border-white/10 p-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="hidden w-full items-center justify-center gap-2 rounded-md p-2 text-xs font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2 lg:flex"
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