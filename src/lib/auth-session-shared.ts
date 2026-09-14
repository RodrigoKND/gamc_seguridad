import type { AuthenticatedUser } from '@/features/auth/types';

// Utilidades de sesión seguras para cliente Y servidor (sin secretos). El API
// (gamc-api) emite:
//  · `gamc_access`   → JWT corto, httpOnly  (lo verifica SOLO el servidor,
//    ver src/lib/auth-token.server.ts — nunca este archivo).
//  · `gamc_refresh`  → httpOnly, solo viaja a /api/auth/refresh (rotación).
//  · `gamc_profile`  → sin httpOnly, JSON {identifier,name,role} para el
//    hook cliente (Sidebar/Topbar) y redirecciones.
//  · `gamc_xsrf`     → token doble envío para mutaciones (header x-csrf-token).

export const AUTH_COOKIE_NAME = 'gamc_access';
export const PROFILE_COOKIE_NAME = 'gamc_profile';

/** Decodifica la cookie `gamc_profile` (JSON plano) para el cliente. */
export function parseSessionCookie(raw: string | undefined | null): AuthenticatedUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthenticatedUser;
    if (!parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Serializa el perfil para la cookie legible (el API lo hace del lado suyo). */
export function serializeSessionCookie(user: AuthenticatedUser): string {
  return JSON.stringify(user);
}
