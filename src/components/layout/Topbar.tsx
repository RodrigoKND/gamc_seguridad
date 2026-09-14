'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, ChevronDown, ChevronRight, Inbox, LogOut, Menu, Search, User } from 'lucide-react';
import { Skeleton } from '@/components/feedback/Skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';

// RF/RNF: Dashboard Shell — Grupo 4 (MASTER.md sección 7.3).
// Altura 64px, hamburguesa en móvil (MASTER.md sección 7.1). Migrado a la
// paleta 2026 el 2026-09-06 (MASTER.md sección 4): barra "flotante" con
// margen, esquinas redondeadas y vidrio (backdrop-blur) en vez de una franja
// pegada al borde — más moderno sin perder la jerarquía sticky.

export interface TopbarNotification {
  id: string;
  title: string;
  timestamp: string;
  read?: boolean;
  guardiaId?: string;
  hechoId?: string;
  kind?: 'sos' | 'bateria' | 'hecho';
}

export interface TopbarProps {
  title: string;
  breadcrumb?: string[];
  onOpenMobileMenu: () => void;
  user: { name: string; role: string };
  onLogout?: () => void;
  notifications: TopbarNotification[];
  notificationsStatus?: 'idle' | 'loading' | 'error';
  onRetryNotifications?: () => void;
  onNotificationClick?: (n: TopbarNotification) => void;
  onMarkAllRead?: () => void;
  onMarkOneRead?: (id: string) => void;
}

export function Topbar({
  title,
  breadcrumb = [],
  onOpenMobileMenu,
  user,
  onLogout,
  notifications,
  notificationsStatus = 'idle',
  onRetryNotifications,
  onNotificationClick,
  onMarkAllRead,
  onMarkOneRead,
}: TopbarProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleGlobalSearch() {
    const q = search.trim();
    if (!q) return;
    const isNumeric = /^\d+$/.test(q);
    const epiKeywords = ['norte', 'central', 'sud', 'cona', 'cercado', 'epi'];
    const isEpi = epiKeywords.some((k) => q.toLowerCase().includes(k));
    if (isNumeric || isEpi || q.length <= 12) router.push(`/guardias?q=${encodeURIComponent(q)}`);
    else router.push(`/hechos?q=${encodeURIComponent(q)}`);
  }

  function handleNotifClick(n: TopbarNotification) {
    if (onMarkOneRead) onMarkOneRead(n.id);
    if (onNotificationClick) onNotificationClick(n);
    else if (n.guardiaId) router.push(`/mapas?guardiaId=${n.guardiaId}`);
    else if (n.hechoId) router.push(`/hechos?q=${n.hechoId}`);
    setIsBellOpen(false);
  }

  return (
    <header className="sticky top-3 z-[1050] m-3 flex h-16 items-center gap-4 rounded-2xl border border-neutral-border/70 bg-white/75 px-4 shadow-[0_1px_2px_rgba(15,15,15,0.03),0_8px_24px_-12px_rgba(15,15,15,0.12)] backdrop-blur-md lg:m-4 lg:px-6">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        aria-label="Abrir menú"
        className="rounded-md p-2 text-neutral-text hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <nav aria-label="Breadcrumb" className="flex min-w-0 shrink-0 items-center gap-1.5 text-sm">
        {breadcrumb.map((crumb) => (
          <span key={crumb} className="flex items-center gap-1.5 text-neutral-text-muted">
            <span className="truncate">{crumb}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </span>
        ))}
        <span className="truncate font-semibold text-neutral-text">{title}</span>
      </nav>

      {/* Búsqueda global — conectada a guardias/hechos (no decorativa) */}
      <div className="hidden min-w-0 flex-1 md:block">
        <label className="sr-only" htmlFor="global-search">Buscar en la plataforma</label>
        <div className="relative mx-auto max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text-muted" aria-hidden="true" />
          <input
            id="global-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGlobalSearch(); }}
            placeholder="Buscar guardia, hecho, zona… (Enter)"
            className="w-full rounded-full border border-neutral-border/80 bg-white/60 py-2 pl-9 pr-3 text-[13px] text-neutral-text placeholder:text-neutral-text-muted transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2"
          />
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsBellOpen((open) => !open)}
            aria-label="Alertas"
            aria-expanded={isBellOpen}
            className="relative rounded-full p-2 text-neutral-text transition-colors duration-200 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-risk-critical px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isBellOpen && (
            <div className="fixed inset-x-3 top-[4.75rem] z-[20] max-h-[80vh] w-auto animate-fade-in-up overflow-hidden rounded-xl border border-neutral-border/70 bg-white/90 p-3 shadow-lg backdrop-blur-md sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80">
              {/* Móvil: fixed centrado al viewport (inset-x-3) para que quede al medio y no pegado a la derecha. Desktop sm+: vuelve a absolute right-0 anclado a la campana. */}
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-text-muted">Alertas</p>
                {unreadCount > 0 && onMarkAllRead && (
                  <button type="button" onClick={onMarkAllRead} className="text-xs font-medium text-brand-gold-600 hover:underline">
                    Marcar leídas
                  </button>
                )}
              </div>

              {notificationsStatus === 'loading' && (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              )}

              {notificationsStatus === 'error' && (
                <ErrorBanner message="No se pudieron cargar las alertas." onRetry={onRetryNotifications} />
              )}

              {notificationsStatus === 'idle' && notifications.length === 0 && (
                <EmptyState icon={Inbox} title="Sin alertas nuevas" className="border-none p-4" />
              )}

              {notificationsStatus === 'idle' && notifications.length > 0 && (
                <ul className="max-h-80 space-y-1 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleNotifClick(n)}
                        className={[
                          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-bg',
                          n.read ? 'text-neutral-text-muted' : 'bg-brand-gold-100/60 font-medium text-neutral-text',
                        ].join(' ')}
                      >
                        <span className="min-w-0 flex-1">
                          <p className="truncate">{n.title}</p>
                          <p className="text-xs text-neutral-text-muted">{n.timestamp}</p>
                        </span>
                        {!n.read && onMarkOneRead && (
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); onMarkOneRead(n.id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onMarkOneRead(n.id); }}}
                            className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold text-brand-gold-700 hover:bg-white"
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((open) => !open)}
            aria-expanded={isUserMenuOpen}
            className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors duration-200 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-ink-900 text-white ring-1 ring-inset ring-brand-gold-500/30">
              <User className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-medium leading-tight text-neutral-text">{user.name}</span>
              <span className="block text-xs leading-tight text-neutral-text-muted">{user.role}</span>
            </span>
            <ChevronDown className="hidden h-4 w-4 text-neutral-text-muted sm:block" aria-hidden="true" />
          </button>

          {isUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 animate-fade-in-up rounded-xl border border-neutral-border/70 bg-white/90 p-1.5 shadow-lg backdrop-blur-md">
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-text transition-colors duration-200 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// Nota: "disabled" (MASTER.md sección 8) no aplica a nivel de Topbar completo
// — cada control interactivo (campana, menú de usuario, Reintentar) gestiona
// su propio estado deshabilitado según corresponda.
