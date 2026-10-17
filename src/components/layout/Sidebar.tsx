'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  ChevronLeft,
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
// Rediseño F7 (2026-10-17, pedido del usuario): tres "burbujas" flotantes de
// tinta sobre el fondo de la página, alineadas con el Topbar flotante —
// arriba la marca, al medio las opciones (centradas en vertical), abajo el
// colapso. El comportamiento no cambia: 264px expandido / 84px colapsado,
// drawer con backdrop en <lg (MASTER.md sección 7.1).
// Paleta del logo (MASTER.md sección 4): ítem activo en píldora dorada
// accent-500 con texto primary-950 (8.3:1); inactivos primary-300 sobre
// primary-900 (7.9:1), blancos al pasar el mouse. Foco: anillo dorado con
// offset del mismo tono de la burbuja.
// Árbol de navegación por rol — MASTER.md sección 7.2 (Opción A: los ítems
// fuera de alcance NO se renderizan, no se muestran deshabilitados). El
// filtrado usa lib/permissions.ts (ROLE_NAV_ROUTES) para no divergir nunca
// del middleware, que usa la misma fuente de verdad.

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

// Registro maestro — el orden acá es el orden visual dentro de cada árbol
// de rol (ROLE_NAV_ROUTES filtra, no reordena).
// Superficie común de las tres burbujas.
const BUBBLE =
  'rounded-2xl bg-primary-900 ring-1 ring-inset ring-accent-500/15 shadow-[0_14px_30px_-16px_rgba(13,13,14,0.55)]';

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
          className="fixed inset-0 z-[1090] animate-fade-in bg-primary-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navegación principal"
        className={[
          'fixed inset-y-0 left-0 z-[1100] flex flex-col gap-3 p-3',
          'transition-[transform,width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:py-4 lg:pl-4 lg:pr-0',
          isCollapsed ? 'lg:w-[84px]' : 'lg:w-[264px]',
          'w-[264px]',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Burbuja 1 — marca */}
        <div className={[BUBBLE, 'flex items-center gap-3 p-2.5', isCollapsed ? 'lg:justify-center' : ''].join(' ')}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] p-1 ring-1 ring-inset ring-accent-500/30">
            <Logo size={28} />
          </span>
          <div className={['min-w-0 animate-fade-in', isCollapsed ? 'lg:hidden' : ''].join(' ')}>
            <p className="truncate text-sm font-semibold tracking-wide text-white">GAMC</p>
            <p className="truncate text-xs text-accent-500">Seguridad Ciudadana</p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Cerrar menú"
            className="ml-auto cursor-pointer rounded-lg p-1.5 text-primary-300 transition-colors duration-200 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 lg:hidden"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Burbuja 2 — opciones, centrada en el alto disponible */}
        <div className="flex min-h-0 flex-1 flex-col justify-center">
          <nav className={[BUBBLE, 'scrollbar-hidden max-h-full overflow-y-auto p-2'].join(' ')}>
            <ul className="stagger-children space-y-1">
              {items.map((item) => {
                const isActive = pathname?.startsWith(item.href) ?? false;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      prefetch
                      aria-current={isActive ? 'page' : undefined}
                      title={isCollapsed ? item.label : undefined}
                      onClick={onCloseMobile}
                      className={[
                        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium',
                        'transition-[background-color,color,box-shadow] duration-200',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-900',
                        isCollapsed ? 'lg:justify-center lg:px-0' : '',
                        isActive
                          ? 'bg-accent-500 font-semibold text-primary-950 shadow-[0_6px_16px_-8px_rgba(197,155,109,0.7)]'
                          : 'text-primary-300 hover:bg-white/[0.07] hover:text-white',
                      ].join(' ')}
                    >
                      <Icon
                        className={[
                          'h-5 w-5 shrink-0 transition-transform duration-200',
                          isActive ? '' : 'group-hover:scale-110',
                        ].join(' ')}
                        aria-hidden="true"
                      />
                      <span className={['truncate', isCollapsed ? 'lg:hidden' : ''].join(' ')}>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Burbuja 3 — colapsar (solo desktop; en móvil se cierra con la X o el backdrop) */}
        <div className={[BUBBLE, 'hidden p-2 lg:block'].join(' ')}>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-expanded={!isCollapsed}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl p-2 text-xs font-medium text-primary-300 transition-colors duration-200 hover:bg-white/[0.07] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-primary-900"
          >
            <ChevronLeft
              className={['h-4 w-4 transition-transform duration-300', isCollapsed ? 'rotate-180' : ''].join(' ')}
              aria-hidden="true"
            />
            {!isCollapsed && <span className="animate-fade-in">Colapsar</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// Nota: "loading", "empty" y "error" (MASTER.md sección 8) no aplican a este
// componente — el árbol de navegación es estático por rol (IA sección 7.2),
// no depende de datos remotos que puedan cargar, estar vacíos o fallar.