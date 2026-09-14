'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { updateHechoEstado } from '@/lib/data-source';
import type { HechoEstado } from '../types';

// RF-G3-02 a 08, MASTER.md sección 13.5/15.1/15.5: solo Operador cambia el
// estado de un hecho. El desplegable del drawer ya está gateado por el
// middleware (solo Operador llega a /hechos), pero esta validación es la
// que de verdad protege la escritura si se invoca la acción directo.

export interface HechoActionResult {
  success: boolean;
  error?: string;
}

export async function updateHechoEstadoAction(id: string, estado: HechoEstado): Promise<HechoActionResult> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (!canWrite(session.role, 'hechos')) {
    return { success: false, error: 'Su rol no tiene permiso para cambiar el estado de un hecho.' };
  }

  try {
    await updateHechoEstado(id, estado);
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'No se pudo actualizar el estado.';
    console.error('[updateHechoEstadoAction] failed', err);
    return { success: false, error: msg };
  }
}
