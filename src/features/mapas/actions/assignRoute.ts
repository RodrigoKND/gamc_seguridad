'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { isApiError } from '@/lib/api/http';
import {
  asignarEjecucion,
  previsualizarAsignacion,
  type AsignacionBody,
  type AvisoAsignacion,
  type ConflictoAsignacion,
  type NoAsignado,
  type PrevisualizacionAsignacion,
} from '@/lib/data-source';
import type { PatrullaModalidad } from '@/types/patrulla';

// RF-G3-09 (F2): la asignación es UNA intención que el
// backend valida y aplica en una transacción. Es PARCIAL (pedido del
// usuario): se asigna a los guardias aptos y vuelve `noAsignados` con el
// motivo de cada uno, para mostrarlo en la ventana flotante al terminar.
// Tampoco "resuelve" ya un SOS: un guardia con alerta abierta no es elegible
// y la alerta se atiende con su propio botón.
//
// Elegibilidad, capacidad, jurisdicción y reasignación viven en el backend
// (motor de ejecuciones); acá solo se arma la intención.

export interface GuardPlacement {
  guardiaId: string;
  lat: number;
  lng: number;
  /** Punto fijo: subpunto elegido para este guardia (si no, el de más cupo). */
  puntoFijoId?: string;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface AssignRouteInput {
  /** Generada al abrir el asistente: reintentos/doble clic no duplican la asignación. */
  claveIdempotencia: string;
  modalidad: PatrullaModalidad;
  /** Ruta de la biblioteca (predeterminada o recurrente) — excluyente con `puntos`. */
  rutaPlantillaId?: string;
  /** F4: punto fijo del catálogo (punto o subpunto) — excluyente con ruta y trazado. */
  puntoFijoId?: string;
  /** F5: horario programado ya abierto: se asigna a ESA ejecución (excluye lo demás). */
  ejecucionId?: string;
  /** Trazado nuevo YA ruteado por calles. */
  puntos?: RoutePoint[];
  /** Solo trazado nuevo: true = se guarda como ruta recurrente (biblioteca); false = dinámica. */
  guardarComoRecurrente?: boolean;
  nombre: string;
  descripcion?: string;
  placements: GuardPlacement[];
  /** Asignaciones actuales que el operador aceptó retirar (las que vio en el aviso). */
  confirmaciones?: { guardiaId: string; patrullaId: string }[];
}

export interface AssignRouteResult {
  success: boolean;
  error?: string;
  /** 409: hace falta confirmar la reasignación de estos guardias. */
  conflictos?: ConflictoAsignacion[];
  /** Guardias que no quedaron asignados (en éxito parcial o cuando nadie pudo). */
  noAsignados?: NoAsignado[];
  avisos?: AvisoAsignacion[];
  asignados?: number;
}

function aBody(data: AssignRouteInput): AsignacionBody {
  if (data.ejecucionId) {
    // F5: el destino lo fija la ejecución (punto del catálogo o trazado copiado).
    return {
      claveIdempotencia: data.claveIdempotencia,
      ejecucionId: data.ejecucionId,
      guardias: data.placements.map((p) => ({
        guardiaId: p.guardiaId,
        ...(p.puntoFijoId ? { puntoFijoId: p.puntoFijoId } : {}),
        ...(p.lat || p.lng ? { punto: [p.lng, p.lat] as [number, number] } : {}),
      })),
      confirmaciones: data.confirmaciones ?? [],
    };
  }
  const guardias = data.placements.map((p) =>
    data.puntoFijoId
      ? // El destino lo fija el catálogo (backend), no las coordenadas del cliente.
        { guardiaId: p.guardiaId, puntoFijoId: p.puntoFijoId ?? null }
      : { guardiaId: p.guardiaId, punto: [p.lng, p.lat] as [number, number] },
  );
  const base = {
    claveIdempotencia: data.claveIdempotencia,
    modalidad: data.modalidad,
    nombre: data.nombre,
    descripcion: data.descripcion ?? null,
    guardias,
    confirmaciones: data.confirmaciones ?? [],
  };
  if (data.puntoFijoId) return { ...base, puntoFijoId: data.puntoFijoId };
  if (data.rutaPlantillaId) return { ...base, rutaPlantillaId: data.rutaPlantillaId };
  return {
    ...base,
    nueva: {
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      trazado: (data.puntos ?? []).map((p) => [p.lng, p.lat] as [number, number]),
      // La recurrente usa la duración por defecto (12 h); se ajusta luego en "Rutas Guardadas".
      tipo: data.guardarComoRecurrente ? 'guardada' : 'dinamica',
    },
  };
}

async function sesionConPermiso(): Promise<string | null> {
  const session = await getServerSession();
  if (!session) return 'No hay sesión activa.';
  if (!canWrite(session.role, 'patrullaje')) return 'Su rol no tiene permiso para asignar rutas de patrullaje.';
  return null;
}

export interface PreviewAssignResult extends Partial<PrevisualizacionAsignacion> {
  success: boolean;
  error?: string;
}

/** Sin escribir: quién ya tiene ruta, quién no podrá asignarse y avisos de GPS (antes de dibujar la ruta). */
export async function previewAssignAction(guardiaIds: string[], puntoFijoId?: string, ejecucionId?: string): Promise<PreviewAssignResult> {
  const error = await sesionConPermiso();
  if (error) return { success: false, error };
  if (guardiaIds.length === 0) return { success: false, error: 'Seleccione al menos un guardia.' };
  try {
    const r = await previsualizarAsignacion({
      guardias: guardiaIds.map((guardiaId) => ({ guardiaId })),
      ...(puntoFijoId ? { puntoFijoId } : {}),
      ...(ejecucionId ? { ejecucionId } : {}),
    });
    return { success: true, ...r };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo verificar a los guardias.' };
  }
}

export async function assignRouteAction(data: AssignRouteInput): Promise<AssignRouteResult> {
  const error = await sesionConPermiso();
  if (error) return { success: false, error };
  if (data.placements.length === 0) return { success: false, error: 'Seleccione al menos un guardia antes de continuar.' };
  if (!data.ejecucionId && !data.rutaPlantillaId && !data.puntoFijoId && (data.puntos?.length ?? 0) < 2) return { success: false, error: 'El trazado de la ruta necesita al menos 2 puntos.' };
  try {
    const r = await asignarEjecucion(aBody(data));
    return { success: true, asignados: r.patrullaIds.length, noAsignados: r.noAsignados ?? [], avisos: r.avisos };
  } catch (err) {
    if (isApiError(err) && err.code === 'REASIGNACION_REQUERIDA') {
      const detalles = err.details as { conflictos?: ConflictoAsignacion[] } | undefined;
      return { success: false, error: err.message, conflictos: detalles?.conflictos ?? [] };
    }
    if (isApiError(err) && err.code === 'SIN_GUARDIAS_ASIGNABLES') {
      const detalles = err.details as { noAsignados?: NoAsignado[] } | undefined;
      return { success: false, error: err.message, noAsignados: detalles?.noAsignados ?? [] };
    }
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo asignar la ruta.' };
  }
}
