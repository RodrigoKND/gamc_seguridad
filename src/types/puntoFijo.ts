// Catálogo de puntos fijos (F4): lugares establecidos (Cristo Seguro,
// Plaza Colón…) con su capacidad, señalizados en el mapa. Un punto puede
// tener subpuntos (un solo nivel: Cristo Seguro → Plataforma / Inicio de
// gradas). La ocupación la cuenta el backend (autoritativa).

export interface OcupantePunto {
  guardiaId: string;
  guardiaNombre: string;
  patrullaId: string;
}

export interface PuntoFijoRow {
  id: string;
  codigo: string;
  padreId: string | null;
  nombre: string;
  descripcion: string | null;
  /** Código de EPI del catálogo (no UUID). */
  epiCodigo: string;
  epiNombre: string;
  /** ubicacion = por coordenadas; manual = fijada por el Super Admin; padre = la de su punto. */
  epiMetodo: 'ubicacion' | 'manual' | 'padre';
  lat: number;
  lng: number;
  /** Del punto completo (suma de sus subpuntos activos, si los tiene). */
  capacidad: number;
  ocupados: number;
  coordenadasAproximadas: boolean;
  origen: 'rol_servicio' | 'manual' | 'prueba';
  activo: boolean;
  version: number;
  /** null = fuera de tu jurisdicción (solo se ve el conteo). */
  ocupantes: OcupantePunto[] | null;
  ejecucionId: string | null;
  subpuntos: PuntoFijoRow[];
}

/** Guardia que impide un cambio en el punto (respuesta 409 PUNTO_OCUPADO). */
export interface OcupanteAfectado extends OcupantePunto {
  puntoFijoId: string;
}

export type PoliticaOcupados = 'trasladar' | 'retirar';

export function libresDe(p: Pick<PuntoFijoRow, 'capacidad' | 'ocupados'>): number {
  return Math.max(0, p.capacidad - p.ocupados);
}
