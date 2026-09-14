'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PROFILE_COOKIE_NAME, parseSessionCookie } from '@/lib/auth-session-shared';
import { logout as serverLogout } from '@/features/auth/actions/login';
import type { AuthenticatedUser } from '../types';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
}

function hasRefreshCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split('; ').some((row) => row.trim().startsWith('gamc_refresh='));
}

function clearClientCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

// 7 días = REFRESH_TOKEN_DAYS del backend (Backend/gamc-backend/src/config/env.ts),
// NO los 15 min de ACCESS_TOKEN_MINUTES. El backend sí reescribe esta misma
// cookie con 15 min en cada login/refresh (shared/cookies.ts), pensado para
// que se renueve sola junto al access token — pero esa escritura solo llega
// al navegador si el flujo de refresh de la Web (Server Action) reenvía el
// Set-Cookie, y aunque lo haga, un usuario inactivo en una pantalla >15 min
// (sin disparar ningún fetch que dispare el refresh) se queda con la cookie
// vencida y sin nadie que la reescriba hasta el próximo remount. Al
// vencerse, `parseSessionCookie` devuelve null y cualquier `canWrite(...)`
// gateado por rol desaparece de la UI aunque la sesión real (gamc_access/
// gamc_refresh, httpOnly) siga totalmente vigente — así se reportó el botón
// "Asignar Ruta" desapareciendo tras dejar un guardia en emergencia.
// `gamc_profile` no es el límite de seguridad real (solo trae
// id/nombre/identifier/role para la UI, sin secretos) — ese límite es el JWT
// httpOnly, validado en el servidor en cada Server Action — así que alargar
// su vida acá no otorga ningún permiso que el servidor no vaya a exigir de
// nuevo igual.
const PROFILE_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function setClientCookie(user: AuthenticatedUser): void {
  try {
    document.cookie = `${PROFILE_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(user))}; path=/; max-age=${PROFILE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    // cookie ilegible: se ignora, el estado en memoria sigue funcionando.
  }
}

/**
 * Sesión del cliente. El JWT real vive en `gamc_access` (httpOnly, lo valida
 * el middleware/fetch del servidor); aquí solo se lee el perfil no sensible
 * (`gamc_profile`) que el API escribió junto a los tokens.
 */
export function useAuthSession() {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const recoveringRef = useRef(false);

  async function syncFromCookie(): Promise<AuthenticatedUser | null> {
    const parsed = parseSessionCookie(readCookie(PROFILE_COOKIE_NAME));
    return parsed;
  }

  async function attemptRecovery(): Promise<boolean> {
    if (recoveringRef.current) return false;
    if (!hasRefreshCookie()) return false;
    recoveringRef.current = true;
    setIsRefreshing(true);
    try {
      const { refreshSessionAction } = await import('@/features/auth/actions/refreshSession');
      const { user: recovered } = await refreshSessionAction();
      if (recovered) {
        setUser(recovered);
        setClientCookie(recovered);
        return true;
      }
      // refresh falló → sesión realmente expirada
      return false;
    } catch {
      return false;
    } finally {
      setIsRefreshing(false);
      recoveringRef.current = false;
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function initialSync() {
      const parsed = await syncFromCookie();
      if (!cancelled) {
        if (parsed) {
          setUser(parsed);
          setIsLoaded(true);
        } else if (hasRefreshCookie()) {
          // Perfil vacío pero refresh vigente → intenta recuperar sin mostrar Invitado
          const ok = await attemptRecovery();
          if (!cancelled) {
            if (!ok) setUser(null);
            setIsLoaded(true);
            if (!ok) {
              // refresh también falló → redirige a login (el middleware ya lo haría en la próxima navegación)
              // No forzamos redirect aquí para no romper navegación, pero sí limpiamos estado
            }
          }
        } else {
          setUser(null);
          setIsLoaded(true);
        }
      }
    }
    initialSync();

    // Re-sincroniza cuando la pestaña vuelve a foco o la cookie cambia (otro tab hizo refresh)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromCookie().then((p) => {
          if (p) setUser(p);
          else if (hasRefreshCookie() && !recoveringRef.current) attemptRecovery();
        });
      }
    };
    const onFocus = () => {
      syncFromCookie().then((p) => {
        if (p) setUser(p);
        else if (hasRefreshCookie()) attemptRecovery();
      });
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    // Polling suave de la cookie (detecta rotación por Server Action en otro comp)
    const pollIv = setInterval(() => {
      syncFromCookie().then((p) => {
        if (p && p.id !== user?.id) setUser(p);
        if (!p && hasRefreshCookie() && isLoaded) attemptRecovery();
      });
    }, 15000);

    // Keepalive: ping cada 5 min vía Server Action → si el access expiró, apiFetch hace refresh silencioso y reescribe cookies
    const keepIv = setInterval(() => {
      import('@/features/auth/actions/refreshSession').then(({ refreshSessionAction }) =>
        refreshSessionAction().then(({ user: u }) => { if (u) { setUser(u); setClientCookie(u);} }).catch(() => {})
      );
    }, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      clearInterval(pollIv);
      clearInterval(keepIv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((nextUser: AuthenticatedUser) => {
    setUser(nextUser);
    setClientCookie(nextUser);
  }, []);

  const logout = useCallback(() => {
    void serverLogout();
    clearClientCookie(PROFILE_COOKIE_NAME);
    clearClientCookie('gamc_xsrf');
    setUser(null);
  }, []);

  return { user, isLoaded: isLoaded && !isRefreshing, isRefreshing, login, logout, refresh: attemptRecovery };
}