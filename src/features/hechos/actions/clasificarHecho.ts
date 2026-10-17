'use server';

import { getServerSession } from '@/lib/auth-session';
import { isApiError } from '@/lib/api/http';
import { clasificarHecho } from '@/lib/data-source';
import type { HechoActionResult } from './updateEstado';

// F3 — Bandeja de supervisión: solo el Super Administrador (alcance global)
// decide la EPI de un hecho ambiguo o fuera de cobertura, o la corrige. El
// backend lo vuelve a validar y deja el cambio en la auditoría.
export async function clasificarHechoAction(id: string, epiCodigo: string): Promise<HechoActionResult> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (session.role !== 'super_admin') return { success: false, error: 'Solo el Super Administrador clasifica hechos.' };
  try {
    await clasificarHecho(id, epiCodigo);
    return { success: true };
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo clasificar el hecho.' };
  }
}
