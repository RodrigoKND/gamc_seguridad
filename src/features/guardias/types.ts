import type { EpiZone } from '@/types/epi';

// RF-01, RF-03, RF-12 (MASTER.md sección 7.3 y 13.1/13.2).
//
// Dos estados independientes por guardia — NUNCA combinarlos en un solo
// badge (MASTER.md sección 13.1): `accountStatus` responde "¿puede este
// guardia existir/loguearse?", `operationalStatus` responde "¿qué está
// haciendo ahora mismo?".

// Valores alineados exactamente con el CHECK real de guardia.estado
// (BD/02_tables.sql, chk_guardia_estado) — 'pendiente_activacion', no
// 'pendiente'.
export const ACCOUNT_STATUSES = ['pendiente_activacion', 'activo', 'inactivo'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  pendiente_activacion: 'Pendiente de activación',
  activo: 'Activo',
  inactivo: 'Inactivo',
};

// Pendiente: ámbar con borde punteado (MASTER.md sección 10) — se
// distingue visualmente de un badge de color sólido para remarcar que es
// un estado transitorio administrativo, no operativo.
export const ACCOUNT_STATUS_BADGE_CLASS: Record<AccountStatus, string> = {
  pendiente_activacion: 'border border-dashed border-risk-medium text-risk-medium',
  activo: 'bg-risk-low/10 text-risk-low',
  inactivo: 'bg-neutral-text-muted/10 text-neutral-text-muted',
};

// Valores alineados exactamente con el CHECK real de
// guardia.estado_operativo (BD/02_tables.sql, chk_guardia_estado_operativo)
// — 'fuera_de_servicio', no 'fuera_servicio'.
export const OPERATIONAL_STATUSES = ['fuera_de_servicio', 'en_servicio', 'emergencia'] as const;
export type OperationalStatus = (typeof OPERATIONAL_STATUSES)[number];

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  fuera_de_servicio: 'Fuera de servicio',
  en_servicio: 'En servicio',
  emergencia: 'Emergencia',
};

export const OPERATIONAL_STATUS_BADGE_CLASS: Record<OperationalStatus, string> = {
  fuera_de_servicio: 'bg-neutral-text-muted/10 text-neutral-text-muted',
  en_servicio: 'bg-risk-low/10 text-risk-low',
  // Emergencia: rojo pulsante (MASTER.md sección 10) — imposible de ignorar.
  emergencia: 'bg-risk-critical/10 text-risk-critical animate-pulse motion-reduce:animate-none',
};

export interface Guard {
  id: string;
  primerNombre: string;
  segundoNombre?: string;
  apellidoPaterno: string;
  // NOT NULL en guardia.apellido_materno (BD/02_tables.sql) — a diferencia
  // de segundoNombre, que sí es opcional en la tabla real.
  apellidoMaterno: string;
  ci: string;
  fechaNacimiento: string; // dd/mm/aaaa
  telefono: string;
  epi: EpiZone;
  accountStatus: AccountStatus;
  operationalStatus: OperationalStatus;
  fotoUrl?: string;
  ubicacionActual?: string;
  turnoInicio?: string;
  turnoFin?: string;
  reportesCount: number;
}

export function guardFullName(g: Pick<Guard, 'primerNombre' | 'segundoNombre' | 'apellidoPaterno' | 'apellidoMaterno'>) {
  return [g.primerNombre, g.segundoNombre, g.apellidoPaterno, g.apellidoMaterno].filter(Boolean).join(' ');
}

export function guardInitials(g: Pick<Guard, 'primerNombre' | 'apellidoPaterno'>) {
  return `${g.primerNombre.charAt(0)}${g.apellidoPaterno.charAt(0)}`.toUpperCase();
}

// Regla de negocio (reportada tras la defensa): 'inactivo' es el
// equivalente a "dado de baja" (despedido) — no debe aparecer en el
// listado operativo general de Guardias (GuardiasView/GuardTable), solo en
// el catálogo/historial completo (GuardCatalogModal, que ya se documenta a
// sí mismo como "buscable histórico + activos"). Vive acá — no en el
// componente — para que cualquier vista que necesite la misma regla la lea
// del mismo sitio en vez de repetir la comparación con 'inactivo'.
export function isDadoDeBaja(g: Pick<Guard, 'accountStatus'>): boolean {
  return g.accountStatus === 'inactivo';
}
