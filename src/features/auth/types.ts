import type { UserRole } from '@/types/user';

// RF/RNF: Login — RF-02, RF-03 (MASTER.md sección 7.3). Genérico para
// cualquier rol del sistema (no exclusivo de Super Administrador).

export type LoginStatus = 'idle' | 'loading' | 'error' | 'success';

export interface LoginCredentials {
  identifier: string;
  password: string;
}

// Los 3 roles reales viven en types/user.ts (tabla `role`, BD/02_tables.sql)
// — se re-exportan acá para no romper los imports existentes de
// features/auth/*.
export { USER_ROLES, USER_ROLE_LABELS } from '@/types/user';
export type { UserRole } from '@/types/user';

export interface AuthenticatedUser {
  id: string;
  name: string;
  identifier: string;
  role: UserRole;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: AuthenticatedUser;
}
