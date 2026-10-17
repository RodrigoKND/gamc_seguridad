'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { isApiError } from '@/lib/api/http';
import { actualizarPuntoFijo, crearPuntoFijo, type PuntoFijoBody } from '@/lib/data-source';
import type { OcupanteAfectado, PoliticaOcupados } from '@/types/puntoFijo';

// Catálogo de puntos fijos (F4, menú "Rutas" → "Puntos Fijos"). El backend
// valida el permiso `puntos_fijos`, la jurisdicción y la ocupación; acá solo
// se descarta a quien no puede administrar el catálogo.
//
// Cambios sobre un punto con guardias: el backend responde 409 PUNTO_OCUPADO
// con los guardias afectados y las opciones (trasladar / retirar); la
// ventana flotante se las muestra al operador y se reintenta con su elección.

export interface PuntoFijoResult {
  success: boolean;
  error?: string;
  id?: string;
  /** 409: el cambio afecta a estos guardias; reintentar con una de `opciones`. */
  ocupantes?: OcupanteAfectado[];
  opciones?: PoliticaOcupados[];
}

async function sesionGestora(): Promise<string | null> {
  const session = await getServerSession();
  if (!session) return 'No hay sesión activa.';
  if (!canWrite(session.role, 'puntos_fijos')) return 'Su rol no tiene permiso para administrar puntos fijos.';
  return null;
}

function aResultado(err: unknown, porDefecto: string): PuntoFijoResult {
  if (isApiError(err) && err.code === 'PUNTO_OCUPADO') {
    const d = err.details as { ocupantes?: OcupanteAfectado[]; opciones?: PoliticaOcupados[] } | undefined;
    return { success: false, error: err.message, ocupantes: d?.ocupantes ?? [], opciones: d?.opciones ?? [] };
  }
  return { success: false, error: isApiError(err) ? err.message : porDefecto };
}

export async function createPuntoFijoAction(body: PuntoFijoBody): Promise<PuntoFijoResult> {
  const error = await sesionGestora();
  if (error) return { success: false, error };
  try {
    const r = await crearPuntoFijo(body);
    return { success: true, id: r.id };
  } catch (err) {
    return aResultado(err, 'No se pudo crear el punto fijo.');
  }
}

export async function updatePuntoFijoAction(id: string, body: PuntoFijoBody): Promise<PuntoFijoResult> {
  const error = await sesionGestora();
  if (error) return { success: false, error };
  try {
    await actualizarPuntoFijo(id, body);
    return { success: true, id };
  } catch (err) {
    return aResultado(err, 'No se pudo guardar el punto fijo.');
  }
}
