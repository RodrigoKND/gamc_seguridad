'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { isApiError } from '@/lib/api/http';
import { actualizarProgramacion, cambiarPlanificador, crearProgramacion, eliminarProgramacion, reanudarAutomatica } from '@/lib/data-source';
import type { EstadoPlanificador, ProgramacionBody, ProgramacionRow } from '@/types/programacion';

// Programación de rutas (F5, menú "Rutas" → "Programar Rutas"). El backend
// valida el permiso `programacion_rutas`, la jurisdicción, el cupo y los
// horarios; acá solo se descarta a quien no puede programar.

export interface ProgramacionResult {
  success: boolean;
  error?: string;
  programacion?: ProgramacionRow;
}

async function sesionProgramadora(): Promise<string | null> {
  const session = await getServerSession();
  if (!session) return 'No hay sesión activa.';
  if (!canWrite(session.role, 'programacion_rutas')) return 'Su rol no tiene permiso para programar rutas.';
  return null;
}

export async function createProgramacionAction(body: ProgramacionBody): Promise<ProgramacionResult> {
  const error = await sesionProgramadora();
  if (error) return { success: false, error };
  try {
    return { success: true, programacion: await crearProgramacion(body) };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo crear la programación.' };
  }
}

export async function updateProgramacionAction(id: string, body: ProgramacionBody): Promise<ProgramacionResult> {
  const error = await sesionProgramadora();
  if (error) return { success: false, error };
  try {
    return { success: true, programacion: await actualizarProgramacion(id, body) };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo guardar la programación.' };
  }
}

export async function deleteProgramacionAction(id: string): Promise<ProgramacionResult> {
  const error = await sesionProgramadora();
  if (error) return { success: false, error };
  try {
    await eliminarProgramacion(id);
    return { success: true };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo eliminar la programación.' };
  }
}

/** F6: tras elegir a mano un reemplazo (o cerrar el selector), la automática sigue al momento. */
export async function resumeAutomaticaAction(ejecucionId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (!canWrite(session.role, 'programacion_rutas') && !canWrite(session.role, 'patrullaje')) {
    return { success: false, error: 'Su rol no puede reanudar la asignación automática.' };
  }
  try {
    await reanudarAutomatica(ejecucionId);
    return { success: true };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo reanudar la asignación automática.' };
  }
}

/** Interruptor del planificador: solo Super Admin (el backend lo repite). */
export async function setPlanificadorAction(habilitado: boolean, motivo?: string): Promise<{ success: boolean; error?: string; estado?: EstadoPlanificador }> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (session.role !== 'super_admin') return { success: false, error: 'Solo el Super Administrador puede pausar o reanudar el planificador.' };
  try {
    return { success: true, estado: await cambiarPlanificador(habilitado, motivo) };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo cambiar el planificador.' };
  }
}
