// Tipos "fila" alineados exactamente con las tablas `role` y `"user"` de
// BD/02_tables.sql (RF-01 a RF-08). Tipo compartido: lo usan auth,
// permisos y Generar Credenciales (2+ módulos) — MASTER.md sección 6.
//
// `role.nombre` tiene un CHECK de 3 valores exactos — sin "supervisor" ni
// variantes; ver comentario chk_role_nombre en el schema real.

export const USER_ROLES = ['super_admin', 'admin', 'operador_monitoreo'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Administrador',
  admin: 'Administrador',
  operador_monitoreo: 'Operador de Monitoreo',
};

export const USER_ESTADOS = ['activo', 'inactivo', 'bloqueado'] as const;
export type UserEstado = (typeof USER_ESTADOS)[number];

// Fila de "user" (usuarios web: Super Admin, Admin, Operador). password_hash
// nunca se expone al cliente — el mock lo omite deliberadamente aquí.
//
// primerNombre/segundoNombre/apellidoPaterno/apellidoMaterno/telefono NO
// existen en la tabla `user` real (BD/02_tables.sql solo tiene email,
// password_hash, role_id, estado, primer_login_requerido) — se agregan acá
// para que Generar Credenciales use el mismo formulario/lógica que
// Guardia (nombre completo en la pantalla de confirmación, MASTER.md
// sección 14.2). Igual que la asunción de sección 15.4: pendiente de
// confirmar si el schema real necesita estas columnas o si quedan
// solo del lado del formulario.
export interface UserRow {
  id: string;
  email: string;
  roleId: string;
  role: UserRole;
  estado: UserEstado;
  primerLoginRequerido: boolean;
  createdBy: string | null;
  createdAt: string;
  primerNombre?: string;
  segundoNombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  telefono?: string;
}
