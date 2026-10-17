'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { isApiError } from '@/lib/api/http';
import { actualizarRuta, archivarRuta, crearRutaPlantilla } from '@/lib/data-source';
import type { PatrullaModalidad, RutaPlantillaRow } from '@/types/patrulla';

// Biblioteca de rutas (F2, menú "Rutas"): rutas PREDETERMINADAS (oficiales,
// 'establecida' en BD) y RECURRENTES ('guardada'). Aquí se crean, editan y
// archivan sin asignarlas a nadie. El permiso fino por tipo lo valida el
// backend (rutas_establecidas para predeterminadas, patrullaje para
// recurrentes); acá solo se descarta a quien no puede tocar ninguna.

export interface RutaBibliotecaResult {
  success: boolean;
  error?: string;
  ruta?: RutaPlantillaRow;
}

async function sesionGestora(): Promise<string | null> {
  const session = await getServerSession();
  if (!session) return 'No hay sesión activa.';
  if (!canWrite(session.role, 'patrullaje') && !canWrite(session.role, 'rutas_establecidas')) {
    return 'Su rol no tiene permiso para gestionar rutas.';
  }
  return null;
}

export interface NuevaRutaPredeterminada {
  nombre: string;
  descripcion?: string;
  modalidad: PatrullaModalidad;
  /** Trazado YA ruteado por calles. */
  puntos: { lat: number; lng: number }[];
}

export async function createDefaultRouteAction(data: NuevaRutaPredeterminada): Promise<RutaBibliotecaResult> {
  const error = await sesionGestora();
  if (error) return { success: false, error };
  if (data.puntos.length < 2) return { success: false, error: 'El trazado necesita al menos 2 puntos.' };
  try {
    const ruta = await crearRutaPlantilla({
      nombre: data.nombre.trim(),
      descripcion: data.descripcion?.trim() || undefined,
      epiId: null,
      trazado: data.puntos.map((p) => [p.lng, p.lat] as [number, number]),
      activa: true,
      modalidad: data.modalidad,
      tipo: 'establecida',
    });
    return { success: true, ruta };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo guardar la ruta.' };
  }
}

/** Parámetros de una ruta predeterminada/recurrente (aplican a las próximas asignaciones). */
export async function updateRouteAction(
  rutaId: string,
  patch: { nombre?: string; descripcion?: string | null; tipo?: 'establecida' | 'guardada'; modalidad?: PatrullaModalidad | null },
): Promise<RutaBibliotecaResult> {
  const error = await sesionGestora();
  if (error) return { success: false, error };
  try {
    await actualizarRuta(rutaId, patch);
    return { success: true };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo guardar la ruta.' };
  }
}

/** Saca la ruta de la biblioteca. Las asignaciones en curso de esa ruta siguen igual. */
export async function archiveRouteAction(rutaId: string): Promise<RutaBibliotecaResult> {
  const error = await sesionGestora();
  if (error) return { success: false, error };
  try {
    await archivarRuta(rutaId);
    return { success: true };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo archivar la ruta.' };
  }
}
