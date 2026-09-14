'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { PrintReport } from '@/features/reportes/components/PrintReport';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { USER_ROLE_LABELS, type AuthenticatedUser } from '@/features/auth/types';
import { RealtimeProvider, useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import { GlobalSosBanner } from '@/components/layout/GlobalSosBanner';

// RF/RNF: Dashboard Shell — Grupo 4 (MASTER.md sección 7.3).
// Ensambla Sidebar + Topbar alrededor del contenido de cada módulo.

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/credenciales': 'Generar Credenciales',
  '/mapas': 'Módulo de Mapas',
  '/hechos': 'Reportes',
  '/guardias': 'Guardias',
  '/reportes': 'Historial',
};

// Sin sesión (acceso directo a una ruta del dashboard fuera del flujo de
// login durante desarrollo) se usa un usuario genérico de respaldo — el
// middleware (sección 15.5) ya habría redirigido a /login antes de llegar
// acá en un flujo normal, esto es solo para que el layout no reviente.
const FALLBACK_USER: AuthenticatedUser = { id: '', name: 'Invitado', identifier: '', role: 'operador_monitoreo' };

const SIDEBAR_COLLAPSED_KEY = 'gamc_sidebar_collapsed';

// El Provider vive acá (una sola conexión de socket por sesión autenticada,
// ver lib/realtime/RealtimeProvider.tsx) envolviendo todo el shell — el
// contenido real vive en DashboardShell, adentro del Provider, porque las
// notificaciones del Topbar necesitan `useRealtimeEvent`.
export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <DashboardShell>{children}</DashboardShell>
    </RealtimeProvider>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, isLoaded, isRefreshing, logout } = useAuthSession() as ReturnType<typeof useAuthSession> & { isRefreshing?: boolean };
  const READ_KEY = 'gamc_notif_read';
  const [notifications, setNotifications] = useState<{ id: string; title: string; timestamp: string; read?: boolean; guardiaId?: string; hechoId?: string; kind?: string }[]>([]);
  const [notifStatus, setNotifStatus] = useState<'idle' | 'loading' | 'error'>('loading');

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    } catch {}
  }, [isCollapsed]);

  function applyRead<T extends { id: string; read?: boolean }>(data: T[]): T[] {
    try {
      const raw = window.localStorage.getItem(READ_KEY);
      const readIds: string[] = raw ? JSON.parse(raw) : [];
      const set = new Set(readIds);
      return data.map((n) => ({ ...n, read: set.has(n.id) || n.read }));
    } catch {
      return data;
    }
  }

  function markOneRead(id: string) {
    try {
      const raw = window.localStorage.getItem(READ_KEY);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(id)) {
        ids.push(id);
        window.localStorage.setItem(READ_KEY, JSON.stringify(ids));
      }
    } catch {}
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }

  function markAllRead() {
    try {
      const ids = notifications.map((n) => n.id);
      window.localStorage.setItem(READ_KEY, JSON.stringify(ids));
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleNotifClick(n: any) {
    markOneRead(n.id);
    if (n.guardiaId) router.push(`/mapas?guardiaId=${n.guardiaId}`);
    else if (n.hechoId) router.push(`/hechos?q=${n.hechoId}`);
    else if (n.kind === 'hecho') router.push('/hechos');
    else router.push('/mapas');
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setNotifStatus('loading');
        const { getNotificaciones } = await import('@/lib/data-source');
        const data: any = await getNotificaciones(10);
        if (!cancelled) {
          setNotifications(applyRead(data));
          setNotifStatus('idle');
        }
      } catch {
        if (!cancelled) setNotifStatus('error');
      }
    }
    load();
    // Respaldo por si el socket compartido no está disponible — el push en
    // vivo de abajo (useRealtimeEvent) es la vía normal.
    const iv = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, []);

  function refreshNotifications() {
    import('@/lib/data-source').then(({ getNotificaciones }) =>
      getNotificaciones(10).then((d: any) => setNotifications(applyRead(d))).catch(() => {}),
    );
  }
  useRealtimeEvent(REALTIME_EVENTS.guardiaUbicacion, refreshNotifications);
  useRealtimeEvent(REALTIME_EVENTS.sosNuevo, refreshNotifications);
  useRealtimeEvent(REALTIME_EVENTS.hechoActualizado, refreshNotifications);

  // Mientras se resuelve la sesión (primer mount o recuperación tras expiry de 15 min)
  // no mostramos "Invitado" — eso era lo que confundía: el refresh seguía vigente
  // pero el perfil había expirado y el hook aún no había recuperado.
  const authUser = user ?? (isLoaded ? FALLBACK_USER : { id: '__loading', name: 'Cargando…', identifier: '', role: 'operador_monitoreo' as const });
  const isSessionResolving = !isLoaded || Boolean(isRefreshing);

  const title = PAGE_TITLES[pathname ?? ''] ?? 'Dashboard';

  useEffect(() => {
    if (!isLoaded || isRefreshing) return;
    if (user) return;
    const hasRefresh = typeof document !== 'undefined' && document.cookie.includes('gamc_refresh=');
    if (!hasRefresh) router.push('/login');
  }, [isLoaded, isRefreshing, user, router]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen bg-neutral-bg print:hidden">
      <Sidebar
        role={authUser.role}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((v) => !v)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={title}
          breadcrumb={['Inicio']}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
          user={{ name: authUser.name, role: USER_ROLE_LABELS[authUser.role] }}
          onLogout={handleLogout}
          notifications={notifications as any}
          notificationsStatus={notifStatus}
          onRetryNotifications={() => {
            setNotifStatus('loading');
            import('@/lib/data-source').then(({ getNotificaciones }) =>
              getNotificaciones(10).then((d: any) => setNotifications(applyRead(d))).then(() => setNotifStatus('idle')).catch(() => setNotifStatus('error')),
            );
          }}
          onNotificationClick={handleNotifClick}
          onMarkAllRead={markAllRead}
          onMarkOneRead={markOneRead}
        />
        <GlobalSosBanner />
        <main className="flex-1">{children}</main>
      </div>

      <PrintReport />
    </div>
  );
}
