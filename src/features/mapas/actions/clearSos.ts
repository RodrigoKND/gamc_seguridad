'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { updateGuardiaEstadoOperativo } from '@/lib/data-source';
import { isApiError } from '@/lib/api/http';

// Bug reportado tras la defensa: todavía no había forma de resolver un SOS
// desde la Web. Decisión práctica (sin flujo de resolución "formal"
// definido aún): el Operador lo marca resuelto a mano desde el desplegable
// del guardia en el Mapa — el botón llama a esta acción, que cambia el
// estado operativo real a 'en_servicio' (no solo la vista), con lo que el
// pin/color/comportamiento de SOS en todo el sistema vuelven a la
// normalidad de inmediato.
//
// Gateada por 'patrullaje' (no 'guardias'): quien atiende el mapa en vivo
// es el Operador, igual que assignRoute.ts.

export interface ClearSosResult {
  success: boolean;
  error?: string;
}

export async function clearSosAction(guardiaId: string): Promise<ClearSosResult> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (!canWrite(session.role, 'patrullaje')) {
    return { success: false, error: 'Su rol no tiene permiso para resolver alertas SOS.' };
  }

  try {
    const guard = await updateGuardiaEstadoOperativo(guardiaId, 'en_servicio');
    if (!guard) return { success: false, error: 'Guardia no encontrado.' };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: isApiError(error) ? error.message : 'No se pudo resolver la alerta SOS. Intente nuevamente.',
    };
  }
}
