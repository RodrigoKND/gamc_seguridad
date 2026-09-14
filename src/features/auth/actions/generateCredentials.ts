'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { crearGuardia, crearUsuario } from '@/lib/data-source';
import { isApiError } from '@/lib/api/http';
import type { EpiZone } from '@/types/epi';
import type { UserRole } from '@/types/user';

// RF-01, RF-03, MASTER.md sección 15.1/15.4/15.5: solo Super Admin genera
// credenciales (Guardia/Operador/Administrador). El ítem de nav y la ruta
// /credenciales ya están gateados (sidebar + middleware), pero esta
// validación es la que realmente protege la escritura si se invoca la
// acción directo.

export interface CredentialsResult {
  success: boolean;
  error?: string;
  usuario?: string;
  passwordTemporal?: string;
}

async function assertCanWriteUsuarios(): Promise<string | null> {
  const session = await getServerSession();
  if (!session) return 'No hay sesión activa.';
  if (!canWrite(session.role, 'usuarios')) return 'Su rol no tiene permiso para generar credenciales.';
  return null;
}

export interface GenerateGuardCredentialsInput {
  primerNombre: string;
  segundoNombre?: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  ci: string;
  fechaNacimiento: string;
  telefono: string;
  epi: EpiZone;
}

export async function generateGuardCredentialsAction(data: GenerateGuardCredentialsInput): Promise<CredentialsResult> {
  const denyReason = await assertCanWriteUsuarios();
  if (denyReason) return { success: false, error: denyReason };

  const session = await getServerSession();
  try {
    const { usuario, passwordTemporal } = await crearGuardia({ ...data, createdBy: session?.identifier ?? 'sistema' });
    return { success: true, usuario, passwordTemporal };
  } catch (error) {
    return { success: false, error: isApiError(error) ? error.message : 'No se pudo crear el guardia. Intente nuevamente.' };
  }
}

// TODO: confirmar regla real de generación de credenciales para
// Operador/Administrador — ver MASTER.md sección 15.4. Por ahora (asunción
// de diseño, no decisión técnica cerrada): usuario = email ingresado,
// contraseña temporal generada al azar y mostrada una sola vez. El
// formulario y la validación de duplicado sí son la MISMA lógica que
// Guardia (nombres/apellidos/teléfono, error inline sin cerrar el modal) —
// ver UserCredentialModal.tsx.
export interface GenerateUserCredentialsInput {
  primerNombre: string;
  segundoNombre?: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono: string;
  email: string;
  role: Exclude<UserRole, 'super_admin'>;
}

export async function generateUserCredentialsAction(data: GenerateUserCredentialsInput): Promise<CredentialsResult> {
  const denyReason = await assertCanWriteUsuarios();
  if (denyReason) return { success: false, error: denyReason };

  const session = await getServerSession();
  try {
    const { usuario, passwordTemporal } = await crearUsuario({ ...data, createdBy: session?.identifier ?? 'sistema' });
    return { success: true, usuario: usuario.email, passwordTemporal };
  } catch (error) {
    return { success: false, error: isApiError(error) ? error.message : 'No se pudo crear el usuario. Intente nuevamente.' };
  }
}
