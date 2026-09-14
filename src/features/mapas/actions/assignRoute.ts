'use server';

import { getServerSession } from '@/lib/auth-session';
import { canWrite } from '@/lib/permissions';
import { isApiError } from '@/lib/api/http';
import { crearPatrulla, crearRutaPlantilla, getGuardiaById, updateGuardiaEstadoOperativo } from '@/lib/data-source';
import { guardFullName, type Guard } from '@/features/guardias/types';
import { PATRULLA_MODALIDAD_CAPACIDAD, PATRULLA_MODALIDAD_LABELS, type GeoJsonPoint, type PatrullaModalidad, type PatrullaRow } from '@/types/patrulla';

// RF-G3-09, MASTER.md sección 10/15.1/15.5: solo Operador asigna/modifica
// rutas. El wizard ya solo se monta dentro de /mapas (Operador-only vía
// middleware), pero esta validación es la que realmente protege la
// escritura si se invoca la acción directo.
//
// Rediseño 2026-09-14 (RF-G3-09): una ruta ahora es un TRAZADO (2 a 5
// puntos, `puntos`) que 1..N guardias comparten — ya no un polígono
// inventado alrededor de cada guardia. `placements` sigue siendo 1 punto
// por guardia, pero ahora es el resultado del reparto estratégico a lo
// largo del trazado (ver AssignRouteWizard + routeGeometry.ts), no un
// clic/arrastre manual. Cada guardia sigue generando su propia fila
// `patrulla` real (API/BD) — la ubicación en el Mapa de Patrullaje en Vivo
// sigue viniendo SOLO de la telemetría real del móvil (verificado contra
// la BD real 2026-09-14: crear una `patrulla` nunca toca
// `guardia_telemetria`), nunca de esta asignación.
//
// Defensa en profundidad de estado operativo (bug reportado tras la
// defensa): AssignRouteWizard ya oculta de la lista a los guardias en SOS o
// fuera de servicio, pero esta acción es la que de verdad protege si el
// estado cambió mientras el wizard estaba abierto o si se invoca directo.
// Fuera de servicio: se rechaza la asignación completa (no tiene sentido
// mandarlo a patrullar). En SOS: se permite — porque asignarle una ruta
// nueva es justamente la señal de que el Operador ya atendió la emergencia
// — pero se le limpia el estado a 'en_servicio' para que no quede en un
// estado mixto (ruta nueva + pin/color de SOS todavía activos).

export interface GuardPlacement {
  guardiaId: string;
  lat: number;
  lng: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface AssignRouteInput {
  modalidad: PatrullaModalidad;
  epiId: string;
  /** Ruta ya guardada (entryMode 'plantilla') — mutuamente excluyente con `puntos`. */
  rutaPlantillaId?: string;
  /** Trazado nuevo (entryMode 'nueva'): 2 a 5 puntos en el orden a recorrer. */
  puntos?: RoutePoint[];
  nombre: string;
  descripcion?: string;
  /** Punto estratégico ya calculado por guardia (routeGeometry.distributeGuardsAlongRoute). */
  placements: GuardPlacement[];
  /** Si la ruta nueva queda visible en "Usar Plantilla Guardada" para el futuro. No afecta que los guardias de ESTA asignación compartan la misma ruta — eso pasa siempre. */
  guardarComoPlantilla?: boolean;
}

export interface AssignRouteResult {
  success: boolean;
  error?: string;
  patrullas?: PatrullaRow[];
}

function toGeoJsonPoint(p: RoutePoint): GeoJsonPoint {
  return { type: 'Point', coordinates: [p.lng, p.lat] };
}

export async function assignRouteAction(data: AssignRouteInput): Promise<AssignRouteResult> {
  const session = await getServerSession();
  if (!session) return { success: false, error: 'No hay sesión activa.' };
  if (!canWrite(session.role, 'patrullaje')) {
    return { success: false, error: 'Su rol no tiene permiso para asignar rutas de patrullaje.' };
  }
  if (data.placements.length === 0) {
    return { success: false, error: 'Seleccione al menos un guardia antes de continuar.' };
  }
  const capacidad = PATRULLA_MODALIDAD_CAPACIDAD[data.modalidad];
  if (data.placements.length > capacidad) {
    return { success: false, error: `${PATRULLA_MODALIDAD_LABELS[data.modalidad]} admite hasta ${capacidad} guardia(s).` };
  }
  if (!data.rutaPlantillaId) {
    // `puntos` acá es el trazado YA ruteado por calles (routing.ts en el
    // wizard) — puede tener decenas/cientos de vértices, no los 2-5 clics
    // del Operador (esos ya se validaron client-side al dibujar). Solo se
    // revisa el mínimo para tener una ruta real.
    const n = data.puntos?.length ?? 0;
    if (n < 2) {
      return { success: false, error: 'El trazado de la ruta necesita al menos 2 puntos.' };
    }
    if (n > 2000) {
      return { success: false, error: 'El trazado de la ruta es demasiado largo.' };
    }
  }

  const guardiasActuales = await Promise.all(data.placements.map((p) => getGuardiaById(p.guardiaId)));
  const fueraDeServicio = guardiasActuales.find((g): g is Guard => g?.operationalStatus === 'fuera_de_servicio');
  if (fueraDeServicio) {
    return { success: false, error: `${guardFullName(fueraDeServicio)} está fuera de servicio y no puede recibir una ruta.` };
  }
  // Mismo criterio que fueraDeServicio arriba: un guardia dado de baja
  // (accountStatus 'inactivo') no necesariamente tiene el estado operativo
  // sincronizado a 'fuera_de_servicio' del lado de la API, así que se
  // revalida por separado en vez de asumir que un campo implica el otro.
  const dadoDeBaja = guardiasActuales.find((g): g is Guard => g?.accountStatus === 'inactivo');
  if (dadoDeBaja) {
    return { success: false, error: `${guardFullName(dadoDeBaja)} está dado de baja y no puede recibir una ruta.` };
  }

  // El trazado se guarda como `ruta_plantilla` SIEMPRE que hay 2+ puntos
  // nuevos — no solo cuando el Operador marca "guardar como reutilizable".
  // Es la única forma de que los N guardias de esta asignación queden
  // enlazados a la MISMA ruta (rutaPlantillaId compartido) para que el
  // panel derecho y el color en el mapa los agrupen — `guardarComoPlantilla`
  // solo decide si además queda visible en "Usar Plantilla Guardada" para
  // asignaciones futuras (activa).
  let rutaPlantillaId = data.rutaPlantillaId;
  if (!rutaPlantillaId && data.puntos) {
    try {
      const ruta = await crearRutaPlantilla({
        nombre: data.nombre,
        descripcion: data.descripcion,
        epiId: data.epiId,
        trazado: data.puntos.map((p) => [p.lng, p.lat] as [number, number]),
        activa: Boolean(data.guardarComoPlantilla),
      });
      rutaPlantillaId = ruta.id;
    } catch (err) {
      if (isApiError(err) && err.status === 404) {
        return {
          success: false,
          error: 'El backend todavía no tiene el endpoint POST /api/mapas/rutas — no se puede crear el trazado de la ruta. Ver informe "Mapa — Rediseño de Rutas".',
        };
      }
      return { success: false, error: isApiError(err) ? err.message : 'No se pudo guardar el trazado de la ruta.' };
    }
  }

  // Bug encontrado en pruebas locales 2026-09-14: antes esto resolvía el
  // uuid del operador con `getUsuarioByEmail` → `GET /api/usuarios`, un
  // endpoint gateado por `authorize('usuarios','ver')` — permiso que
  // operador_monitoreo NO tiene (solo super_admin/admin). Para el rol que
  // realmente usa el mapa día a día, esa llamada tiraba 403 sin capturar,
  // reventando toda la acción DESPUÉS de crear la ruta pero ANTES de crear
  // ninguna patrulla (la ruta quedaba huérfana, sin guardias asignados, y
  // el Operador nunca veía un error claro). El JWT ya trae el propio id del
  // usuario (`sub`) — no hace falta ninguna consulta extra para saber quién
  // es uno mismo.
  const operadorId = session.id;
  // unidadId solo si viajan 2+ juntos — un guardia solo (Caso A) no
  // necesita agruparse con nadie.
  const unidadId = data.placements.length > 1 ? `UN-${Date.now()}` : undefined;

  // Errores de crearPatrulla ahora se capturan (antes se dejaban propagar
  // como excepción sin manejar, en vez de un AssignRouteResult claro) — una
  // patrulla individual puede fallar (ej. un guardia se dio de baja entre
  // la validación de arriba y este punto) sin que el Operador se quede sin
  // ninguna explicación.
  const patrullas: PatrullaRow[] = [];
  try {
    for (const placement of data.placements) {
      // eslint-disable-next-line no-await-in-loop -- una petición POST por guardia (el API no expone alta por lote).
      const patrulla = await crearPatrulla({
        guardiaId: placement.guardiaId,
        operadorId,
        epiId: data.epiId,
        rutaPlantillaId,
        nombre: data.nombre,
        descripcion: data.descripcion,
        poligonoGeojson: toGeoJsonPoint(placement),
        modalidad: data.modalidad,
        unidadId,
      });
      patrullas.push(patrulla);
    }
  } catch (err) {
    return { success: false, error: isApiError(err) ? err.message : 'No se pudo crear la patrulla.' };
  }

  const enSos = guardiasActuales.filter((g): g is Guard => g?.operationalStatus === 'emergencia');
  await Promise.all(enSos.map((g) => updateGuardiaEstadoOperativo(g.id, 'en_servicio')));

  return { success: true, patrullas };
}
