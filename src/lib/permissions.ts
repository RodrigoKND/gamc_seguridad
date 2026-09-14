import type { UserRole } from '@/types/user';

// RF-01 a RF-08 (MASTER.md sección 15 — Matriz de Visibilidad y Lógica por
// Rol). Fuente única de verdad de qué rutas/acciones puede tocar cada rol
// en este recorte de MVP: la importan middleware.ts (protección de ruta,
// sección 15.5), Sidebar (ocultar ítems, Opción A) y los Server Actions
// (validación de escritura, también sección 15.5) — así nunca pueden
// divergir entre sí.
//
// Actualización confirmada: Super Admin y Admin también pueden VER Módulo
// de Mapas y Reportes/Historial (ya no es Opción A pura — MASTER.md
// sección 15.2 queda desactualizada en ese punto). Cambiar el estado de un
// hecho sigue siendo exclusivo del Operador; asignar/modificar rutas ahora
// lo pueden hacer Super Admin y Operador (ver WRITE_MATRIX) — coincide con
// `role_permission` de la BD real, donde super_admin ya tenía
// patrullaje.crear=true (BD/05_seed.sql).
// Esto además acerca la matriz a `role_permission` de la BD real
// (BD/05_seed.sql), que ya daba lectura de mapas/hechos a Admin.

interface RouteRule {
  path: string;
  roles: UserRole[];
}

// El Operador no tiene Dashboard (decisión confirmada) — su pantalla de
// aterrizaje es Módulo de Mapas, ver ROLE_HOME_ROUTE más abajo.
const ROUTE_RULES: RouteRule[] = [
  { path: '/dashboard', roles: ['super_admin', 'admin'] },
  { path: '/credenciales', roles: ['super_admin'] },
  { path: '/guardias', roles: ['super_admin', 'admin', 'operador_monitoreo'] },
  { path: '/mapas', roles: ['super_admin', 'admin', 'operador_monitoreo'] },
  { path: '/hechos', roles: ['super_admin', 'admin', 'operador_monitoreo'] },
  { path: '/reportes', roles: ['super_admin', 'admin', 'operador_monitoreo'] },
];

function findRouteRule(pathname: string): RouteRule | undefined {
  return ROUTE_RULES.find((rule) => pathname === rule.path || pathname.startsWith(`${rule.path}/`));
}

// Rutas no listadas (ej. /login) no se gatean por rol acá.
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const rule = findRouteRule(pathname);
  if (!rule) return true;
  return rule.roles.includes(role);
}

// Ítems de navegación del sidebar por rol. El orden de cada arreglo es el
// orden en que aparecen en el sidebar. El Operador no tiene Dashboard: su
// primera pantalla es Módulo de Mapas.
export const ROLE_NAV_ROUTES: Record<UserRole, string[]> = {
  super_admin: ['/dashboard', '/credenciales', '/mapas', '/guardias', '/hechos'],
  admin: ['/dashboard', '/mapas', '/guardias', '/hechos'],
  operador_monitoreo: ['/mapas', '/guardias', '/hechos'],
};

// Pantalla de aterrizaje por rol — a dónde va el login al autenticar
// (LoginForm) y a dónde redirige el middleware cuando bloquea una ruta
// fuera de alcance (nunca de vuelta a /dashboard para el Operador, que no
// lo tiene).
export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  super_admin: '/dashboard',
  admin: '/dashboard',
  operador_monitoreo: '/mapas',
};

// Matriz de escritura (Server Actions) — MASTER.md sección 15.1/15.5:
// "crear" guardia NO está en ningún rol acá porque vive en Generar
// Credenciales (resource 'usuarios').
export type WriteResource = 'guardias' | 'usuarios' | 'hechos' | 'patrullaje';

const WRITE_MATRIX: Record<WriteResource, UserRole[]> = {
  guardias: ['super_admin', 'admin'],
  usuarios: ['super_admin'],
  hechos: ['operador_monitoreo'],
  patrullaje: ['super_admin', 'operador_monitoreo'],
};

export function canWrite(role: UserRole, resource: WriteResource): boolean {
  return WRITE_MATRIX[resource].includes(role);
}
