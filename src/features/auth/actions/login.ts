'use server';

import { cookies } from 'next/headers';
import { authApi, isApiError } from '@/lib/api/auth';
import { AUTH_COOKIE_NAME, PROFILE_COOKIE_NAME } from '@/lib/auth-session-shared';
import type { LoginCredentials, LoginResult, UserRole } from '../types';

/**
 * Autenticación contra gamc-api. El API responde las cookies de sesión
 * (gamc_access/gamc_refresh/gamc_profile/gamc_xsrf), que apiFetch reenvía al
 * navegador. Acá solo se traduce el resultado para la UI.
 */
export async function login({ identifier, password }: LoginCredentials): Promise<LoginResult> {
  try {
    const principal = await authApi.login(identifier, password);
    return {
      success: true,
      user: {
        id: principal.id,
        name: principal.name,
        identifier: principal.identifier,
        role: principal.role as UserRole,
      },
    };
  } catch (err) {
    if (isApiError(err)) {
      if (err.status === 403) {
        return {
          success: false,
          error: 'Su cuenta está deshabilitada o suspendida. Contacte al administrador del sistema.',
        };
      }
      return {
        success: false,
        error: 'Usuario o contraseña incorrectos. Verifique sus credenciales e intente nuevamente.',
      };
    }
    return { success: false, error: 'El servicio no está disponible. Intente más tarde.' };
  }
}

/** Cierra la sesión: revoca el refresh token en el API y borra las cookies. */
export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // si el API no responde, igual se limpia la sesión local.
  }
  const store = await cookies();
  store.delete(AUTH_COOKIE_NAME);
  store.delete('gamc_refresh');
  store.delete(PROFILE_COOKIE_NAME);
  store.delete('gamc_xsrf');
}