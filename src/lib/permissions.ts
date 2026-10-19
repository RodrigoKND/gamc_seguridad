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
// 'rutas_establecidas' (F2): crear/editar rutas PREDETERMINADAS (oficiales)
// — los 3 roles, por decisión del usuario (puede que luego se le quite al
// Admin). Archivar una predeterminada queda solo para Super Admin, como en
// `role_permission` (rutas_establecidas.eliminar).
// 'puntos_fijos' (F4): catálogo de puntos fijos — Operador (en su EPI) y
// Super Admin; el Admin solo los ve (`role_permission`, migración 0009).
// 'programacion_rutas' (F5): programar rutas y puntos fijos por horario —
// Operador (en su EPI) y Super Admin; el Admin solo ve la agenda (0010).
export type WriteResource = 'guardias' | 'usuarios' | 'hechos' | 'patrullaje' | 'rutas_establecidas' | 'puntos_fijos' | 'programacion_rutas' | 'estado_operativo' | 'hechos_dashboard';

const WRITE_MATRIX: Record<WriteResource, UserRole[]> = {
  guardias: ['super_admin', 'admin'],
  usuarios: ['super_admin'],
  hechos: ['operador_monitoreo'],
  patrullaje: ['super_admin', 'operador_monitoreo'],
  rutas_establecidas: ['super_admin', 'admin', 'operador_monitoreo'],
  puntos_fijos: ['super_admin', 'operador_monitoreo'],
  programacion_rutas: ['super_admin', 'operador_monitoreo'],
  // Poner a un guardia en/fuera de servicio a mano (modal de edición de
  // Guardias). El backend lo permite con `guardias:editar` (Super Admin y Admin).
  estado_operativo: ['super_admin', 'admin'],
  // Resolver un hecho desde el drawer del Dashboard — que solo ven Super
  // Admin y Admin; el backend ya permite `hechos:editar` a ambos. La
  // pantalla /hechos sigue gateada por 'hechos' (solo Operador).
  hechos_dashboard: ['super_admin', 'admin'],
};

/** Archivar una ruta predeterminada (rutas_establecidas.eliminar). */
export function canArchiveEstablecida(role: UserRole): boolean {
  return role === 'super_admin';
}

export function canWrite(role: UserRole, resource: WriteResource): boolean {
  return WRITE_MATRIX[resource].includes(role);
}
