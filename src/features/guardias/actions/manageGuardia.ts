'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { updateGuardiaBiografia, updateGuardiaEstado, updateGuardiaEstadoOperativo } from '@/lib/data-source';
import type { GuardiaRow } from '@/types/guardia';
import type { AccountStatus, Guard, OperationalStatus } from '../types';

// RF-01, RF-12, MASTER.md sección 15.1/15.5: Super Admin y Admin pueden
// editar/activar/desactivar guardias; Operador NO. El botón ya está oculto
// en el frontend (GuardiasView) para Operador, pero eso es solo UX — esta
// validación es la que realmente importa si alguien invoca la acción
// directo (defensa en profundidad).

export interface GuardiaActionResult {
  success: boolean;
  error?: string;
  guard?: Guard;
}

async function assertCanWriteGuardias(): Promise<string | null> {
  const session = await getServerSession();
  if (!session) return 'No hay sesión activa.';
  if (!canWrite(session.role, 'guardias')) return 'Su rol no tiene permiso para modificar guardias.';
  return null;
}

type BiografiaPatch = Partial<
  Pick<GuardiaRow, 'primerNombre' | 'segundoNombre' | 'apellidoPaterno' | 'apellidoMaterno' | 'telefono' | 'epiId'>
>;

export async function updateGuardiaAction(id: string, patch: BiografiaPatch): Promise<GuardiaActionResult> {
  const denyReason = await assertCanWriteGuardias();
  if (denyReason) return { success: false, error: denyReason };

  const guard = await updateGuardiaBiografia(id, patch);
  if (!guard) return { success: false, error: 'Guardia no encontrado.' };
  return { success: true, guard };
}

export async function toggleGuardiaEstadoAction(id: string, estado: AccountStatus): Promise<GuardiaActionResult> {
  const denyReason = await assertCanWriteGuardias();
  if (denyReason) return { success: false, error: denyReason };

  const guard = await updateGuardiaEstado(id, estado);
  if (!guard) return { success: false, error: 'Guardia no encontrado.' };
  return { success: true, guard };
}

// Solo en_servicio / fuera_de_servicio: 'emergencia' lo gobierna el SOS y se
// resuelve desde el Mapa/Dashboard, no con este interruptor.
export async function toggleGuardiaEstadoOperativoAction(
  id: string,
  estado: Extract<OperationalStatus, 'en_servicio' | 'fuera_de_servicio'>,
): Promise<GuardiaActionResult> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (!canWrite(session.role, 'estado_operativo')) {
    return { success: false, error: 'Su rol no tiene permiso para cambiar el estado de servicio.' };
  }
  if (estado !== 'en_servicio' && estado !== 'fuera_de_servicio') {
    return { success: false, error: 'Estado de servicio inválido.' };
  }
  try {
    const guard = await updateGuardiaEstadoOperativo(id, estado);
    if (!guard) return { success: false, error: 'Guardia no encontrado.' };
    return { success: true, guard };
  } catch {
    return { success: false, error: 'No se pudo cambiar el estado de servicio.' };
  }
}
