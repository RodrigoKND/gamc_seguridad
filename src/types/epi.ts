// EPI (Estación Policial Integral) — catálogo DINÁMICO (cambios/04 F1).
//
// Antes había una lista fija de 5 "slugs" propios de la Web (norte, central,
// sud, cona, centro) traducidos a mano a los códigos del backend; un código
// nuevo o desconocido caía en "Centro" y los filtros mandaban slugs que el
// backend no conocía (HTTP 500). Ahora la EPI se identifica SIEMPRE por el
// código del backend (`sud`, `jaihuayco`, `cona_cona`…) y nombre, color,
// sede y territorio vienen de GET /api/epis (inventario oficial, 6 EPIs).

/** Código de EPI del backend (`epi.codigo`). No es un UUID. */
export type EpiZone = string;

export interface EpiTelefono {
  tipo: string;
  numero: string;
}

export interface EpiInfo {
  id: string;
  codigo: EpiZone;
  numero: number | null;
  nombre: string;
  nombreOficial: string | null;
  color: string | null;
  activo: boolean;
  /** Activa y con territorio vigente: recibe rutas, usuarios y hechos nuevos. */
  operativa: boolean;
  sede: { lat: number; lng: number; direccion: string | null } | null;
  telefonos: EpiTelefono[];
  territorio: { version: number; aproximado: boolean; origen: string; poligono: unknown } | null;
}

/** Color neutro para registros sin EPI o con un código que el catálogo no conoce. */
export const EPI_COLOR_SIN_DATO = '#9CA3AF';

export const EPI_SIN_DATO = 'Sin EPI';

/** "EPI Norte" — o el código tal cual si el catálogo aún no lo conoce (nunca "Centro"). */
export function nombreEpi(catalogo: readonly EpiInfo[], codigo: EpiZone | null | undefined): string {
  if (!codigo) return EPI_SIN_DATO;
  return catalogo.find((e) => e.codigo === codigo)?.nombre ?? `EPI ${codigo}`;
}

/** "Norte" — nombre sin el prefijo "EPI", para chips y columnas angostas. */
export function nombreCortoEpi(catalogo: readonly EpiInfo[], codigo: EpiZone | null | undefined): string {
  return nombreEpi(catalogo, codigo).replace(/^EPI\s+/i, '');
}

export function colorEpi(catalogo: readonly EpiInfo[], codigo: EpiZone | null | undefined): string {
  if (!codigo) return EPI_COLOR_SIN_DATO;
  const c = catalogo.find((e) => e.codigo === codigo)?.color;
  return c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : EPI_COLOR_SIN_DATO;
}

/** Orden oficial (N° 1 a 6) y luego las históricas. */
export function ordenarEpis(catalogo: readonly EpiInfo[]): EpiInfo[] {
  return [...catalogo].sort(
    (a, b) => Number(b.operativa) - Number(a.operativa) || (a.numero ?? 999) - (b.numero ?? 999) || a.codigo.localeCompare(b.codigo),
  );
}
