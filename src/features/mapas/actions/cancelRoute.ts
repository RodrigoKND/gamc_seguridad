'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { cancelarEjecucion, cancelarPatrulla } from '@/lib/data-source';
import { isApiError } from '@/lib/api/http';

// RF-G3-09 (rediseño de rutas 2026-09-14): "cancelar la ruta" saca a TODOS
// los guardias vigentes de esa ruta compartida de un solo golpe (mismo
// criterio que assignRouteAction: una ruta grupal se gestiona como unidad,
// no guardia por guardia). Gateada por 'patrullaje' igual que
// assignRoute.ts/clearSos.ts — es la misma familia de acciones de "manejar
// el mapa en vivo" del Operador.

export interface CancelRouteResult {
  success: boolean;
  error?: string;
  cancelados?: number;
}

// F2: se cancela UNA ejecución (la ruta tal como se asignó en ese momento);
// otras asignaciones de la misma ruta guardada no se tocan.
export async function cancelRouteAction(ejecucionId: string): Promise<CancelRouteResult> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (!canWrite(session.role, 'patrullaje')) {
    return { success: false, error: 'Su rol no tiene permiso para cancelar rutas de patrullaje.' };
  }

  try {
    const result = await cancelarEjecucion(ejecucionId);
    return { success: true, cancelados: result.cancelados };
  } catch (error) {
    return {
      success: false,
      error: isApiError(error) ? error.message : 'No se pudo cancelar la ruta. Intente nuevamente.',
    };
  }
}

// Complemento (2026-09-14): saca a UN guardia (o varios, de a uno) de una
// ruta compartida sin cancelar la ruta completa — `patrullaId` es la fila
// propia de ese guardia (PatrullaRow.id), no el id de la ruta.
export interface CancelGuardFromRouteResult {
  success: boolean;
  error?: string;
}

export async function cancelGuardFromRouteAction(patrullaId: string, reposicion?: 'automatica' | 'manual'): Promise<CancelGuardFromRouteResult> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (!canWrite(session.role, 'patrullaje')) {
    return { success: false, error: 'Su rol no tiene permiso para cancelar rutas de patrullaje.' };
  }

  try {
    await cancelarPatrulla(patrullaId, reposicion);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: isApiError(error) ? error.message : 'No se pudo sacar al guardia de la ruta. Intente nuevamente.',
    };
  }
}
