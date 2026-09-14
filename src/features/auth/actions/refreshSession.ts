'use server';

import { authApi } from '@/lib/api/auth';
import { PROFILE_COOKIE_NAME } from '@/lib/auth-session-shared';
import { cookies } from 'next/headers';
import type { AuthenticatedUser } from '../types';

/**
 * Intenta recuperar la sesión cuando `gamc_profile` expiró pero el refresh
 * sigue vigente. Llama a `GET /api/auth/me` vía apiFetch — si el access ya
 * venció, apiFetch hace el refresh silencioso y reescribe `gamc_access` +
 * `gamc_profile` + `gamc_xsrf` vía Set-Cookie antes de reintentar /me.
 * Devuelve el principal para hidratar el estado cliente.
 */
export async function refreshSessionAction(): Promise<{ user: AuthenticatedUser | null; refreshed: boolean }> {
  try {
    const principal = await authApi.me();
    // apiFetch ya aplicó Set-Cookie al jar de esta request; el navegador lo
    // recibirá en la respuesta de la Server Action. También aseguramos que
    // `gamc_profile` quede escrito por si el backend no lo hizo (redundante).
    const store = await cookies();
    const existing = store.get(PROFILE_COOKIE_NAME)?.value;
    if (!existing) {
      store.set(PROFILE_COOKIE_NAME, JSON.stringify({
        id: principal.id,
        name: principal.name,
        identifier: principal.identifier,
        role: principal.role,
      }), {
        path: '/',
        maxAge: 7 * 24 * 60 * 60,
        sameSite: 'lax',
      });
    }
    return {
      user: {
        id: principal.id,
        name: principal.name,
        identifier: principal.identifier,
        role: principal.role as AuthenticatedUser['role'],
      },
      refreshed: true,
    };
  } catch {
    return { user: null, refreshed: false };
  }
}
