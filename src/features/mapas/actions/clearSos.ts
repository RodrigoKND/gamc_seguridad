'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { atenderSos } from '@/lib/data-source';
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
  /** Alertas que siguen abiertas (llegaron después de las que se atendieron). */
  pendientes?: number;
}

// F2: atiende EXACTAMENTE las alertas que el operador vio (`alertaIds`); si
// llegó un SOS nuevo después, ese sigue abierto. El estado operativo lo
// deriva el backend del turno real (antes se forzaba 'en_servicio').
export async function clearSosAction(guardiaId: string, alertaIds?: string[]): Promise<ClearSosResult> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (!canWrite(session.role, 'patrullaje')) {
    return { success: false, error: 'Su rol no tiene permiso para resolver alertas SOS.' };
  }

  try {
    const r = await atenderSos(guardiaId, alertaIds);
    return { success: true, pendientes: r.pendientes };
  } catch (error) {
    return {
      success: false,
      error: isApiError(error) ? error.message : 'No se pudo resolver la alerta SOS. Intente nuevamente.',
    };
  }
}
