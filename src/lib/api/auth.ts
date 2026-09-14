// Cliente del módulo de autenticación (gamc-api /api/auth). Todas estas
// funciones se ejecutan en servidor (Server Actions) y manejan las cookies
// de sesión automáticamente vía apiFetch (refresco + Set-Cookie al navegador).

import { apiFetch } from './http';

export interface ApiPrincipal {
  id: string;
  identifier: string;
  name: string;
  role: string;
  debeCambiarPassword: boolean;
}

export interface RecoveryRequestResult {
  accepted: boolean;
  expiresAt: string;
  devCode?: string;
}

export const authApi = {
  async login(identifier: string, password: string): Promise<ApiPrincipal> {
    const { principal } = await apiFetch<{ principal: ApiPrincipal }>('/api/auth/login', {
      method: 'POST',
      body: { identifier, password },
      refreshOn401: false,
    });
    return principal;
  },

  async logout(): Promise<void> {
    await apiFetch<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      refreshOn401: false,
    });
  },

  async me(): Promise<ApiPrincipal> {
    const { principal } = await apiFetch<{ principal: ApiPrincipal }>('/api/auth/me');
    return principal;
  },

  async requestRecovery(identifier: string): Promise<RecoveryRequestResult> {
    return apiFetch<RecoveryRequestResult>('/api/auth/recovery/request', {
      method: 'POST',
      body: { identifier },
      refreshOn401: false,
    });
  },

  async confirmRecovery(identifier: string, code: string, newPassword: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>('/api/auth/recovery/confirm', {
      method: 'POST',
      body: { identifier, code, newPassword },
      refreshOn401: false,
    });
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
    return apiFetch<{ ok: boolean }>('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    });
  },
};

export { isApiError, type ApiError } from './http';