'use server';

import { cache } from 'react';
import type { EpiZone } from '@/types/epi';
import type { UserRow } from '@/types/user';
import type { GuardiaRow } from '@/types/guardia';
import type { PatrullaRow, RutaPlantillaRow, GeoJsonPolygon, GeoJsonPoint, TrazadoPuntos, PatrullaEstado } from '@/types/patrulla';
import type { ZonaCriticaActivaRow } from '@/types/hecho';
import type { Guard } from '@/features/guardias/types';
import type { Hecho } from '@/features/hechos/types';
import type { GuardMarker } from '@/features/mapas/types';
import type { HechoPorDiaPoint, HechoPorTipoItem, HechoPorZonaItem } from '@/features/dashboard/types';
import { apiFetch } from '@/lib/api/http';

// ---------------------------------------------------------------------------
// Guardias / Usuarios / Dashboard — conectados al backend real (gamc-api).
// Mapas y Hechos siguen sobre los mocks de abajo (*_DB) hasta que se
// resuelva el fork con la rama del compañero en esos dos módulos.
// ---------------------------------------------------------------------------

const EPI_CODIGO_A_SLUG: Record<string, EpiZone> = {
  norte: 'norte',
  central: 'central',
  sud: 'sud',
  cona_cona: 'cona',
  centro_cercado: 'centro',
};

const EPI_SLUG_A_CODIGO: Record<EpiZone, string> = {
  norte: 'norte',
  central: 'central',
  sud: 'sud',
  cona: 'cona_cona',
  centro: 'centro_cercado',
};

function epiDeCodigo(codigo: string | null | undefined): EpiZone {
  return (codigo && EPI_CODIGO_A_SLUG[codigo]) || 'centro';
}

function toApiDate(value: string | Date): Date {
  return typeof value === 'string' ? new Date(value) : value;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toDDMMAAAA(value: string | Date): string {
  const d = toApiDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// Adaptador único de datos frontend → API real (gamc-api). Cada función
// exporta la misma firma que consumen acciones y vistas, y mapea los DTO
// del API a los tipos de vista. Todas corren en servidor (Server Actions /
// Server Components) — la sesión viaja vía cookies httpOnly a través de
// `apiFetch`, que maneja el refresh y los Set-Cookie de vuelta.

// ---------------------------------------------------------------------------
// GUARDIAS — conectado a /api/guardias (gamc-api). `accountStatus` no
// admite 'suspendido' en el tipo de vista (features/guardias/types.ts):
// se colapsa a 'inactivo', igual que hace la propia UI al desactivar.
// ---------------------------------------------------------------------------

interface ApiGuardiaUbicacion {
  lat: number;
  lng: number;
  direccion: string | null;
  bateriaPct: number | null;
  capturadoEn: string;
}

interface ApiGuardia {
  id: string;
  primerNombre: string;
  segundoNombre: string | null;
  apellidoPaterno: string;
  apellidoMaterno: string;
  ci: string;
  telefono: string;
  fechaNacimiento: string;
  epiId: string | null;
  epiCodigo: string | null;
  estado: string;
  estadoOperativo: string;
  fotoUrl: string | null;
  ubicacion: ApiGuardiaUbicacion | null;
}

interface ApiHechoMini {
  guardiaId: string;
}

function rowToGuardApi(row: ApiGuardia, reportesCount: number): Guard {
  return {
    id: row.id,
    primerNombre: row.primerNombre,
    segundoNombre: row.segundoNombre ?? undefined,
    apellidoPaterno: row.apellidoPaterno,
    apellidoMaterno: row.apellidoMaterno,
    ci: row.ci,
    fechaNacimiento: toDDMMAAAA(row.fechaNacimiento),
    telefono: row.telefono ?? '',
    epi: epiDeCodigo(row.epiCodigo),
    accountStatus: (row.estado === 'suspendido' ? 'inactivo' : row.estado) as Guard['accountStatus'],
    operationalStatus: row.estadoOperativo as Guard['operationalStatus'],
    reportesCount,
    fotoUrl: row.fotoUrl ?? undefined,
    // Nunca lat/lng crudos en pantalla (pedido explícito 2026-09-14) — si
    // hay ubicación pero todavía no se resolvió la dirección (Nominatim en
    // background, ver geocoding.service.ts), se ve este texto en vez de
    // coordenadas. `undefined` se mantiene solo cuando el guardia nunca
    // reportó ubicación (caso distinto, sin dato en absoluto).
    ubicacionActual: row.ubicacion ? (row.ubicacion.direccion ?? 'Ubicación no disponible') : undefined,
  };
}

export const getGuardias = cache(async (): Promise<Guard[]> => {
  const [guardias, hechos] = await Promise.all([
    apiFetch<ApiGuardia[]>('/api/guardias', { revalidate: 15 }),
    apiFetch<ApiHechoMini[]>('/api/hechos', { revalidate: 30 }).catch(() => [] as ApiHechoMini[]),
  ]);
  const reportesPorGuardia = new Map<string, number>();
  for (const h of hechos) reportesPorGuardia.set(h.guardiaId, (reportesPorGuardia.get(h.guardiaId) ?? 0) + 1);
  return guardias.map((g) => rowToGuardApi(g, reportesPorGuardia.get(g.id) ?? 0));
});

export async function getGuardiaById(id: string): Promise<Guard | null> {
  const row = await apiFetch<ApiGuardia | null>(`/api/guardias/${encodeURIComponent(id)}`);
  return row ? rowToGuardApi(row, 0) : null;
}

// ---------------------------------------------------------------------------
// HECHOS — conectado a /api/hechos. estado: la BD usa
// reportado/en_revision/cerrado; la vista usa abierto/en_proceso/resuelto
// (features/hechos/types.ts) — se traduce en ambas direcciones.
// ---------------------------------------------------------------------------

const HECHO_ESTADO_A_API: Record<Hecho['estado'], string> = {
  abierto: 'reportado',
  en_proceso: 'en_revision',
  resuelto: 'cerrado',
};

function hechoEstadoDeApi(estado: string): Hecho['estado'] {
  if (estado === 'reportado') return 'abierto';
  if (estado === 'en_revision') return 'en_proceso';
  return 'resuelto';
}

interface ApiHechoEvidencia {
  id: string;
  url: string;
  tipo: string;
}

interface ApiHecho {
  id: string;
  tipoLabel: string;
  descripcion: string;
  nivelRiesgo: string;
  lat: number;
  lng: number;
  direccion: string | null;
  ocurridoEn: string;
  estado: string;
  epiCodigo: string | null;
  guardiaNombre: string;
  guardiaId: string;
  evidencias?: ApiHechoEvidencia[] | null;
}

function rowToHechoApi(row: ApiHecho): Hecho {
  const evs = row.evidencias ?? [];
  return {
    id: row.id,
    tipo: row.tipoLabel,
    severidad: row.nivelRiesgo as Hecho['severidad'],
    // Nunca lat/lng crudos EN TEXTO (pedido explícito 2026-09-14) — el
    // backend ya resuelve `direccion` vía Nominatim (hechos.service.ts), y
    // si por algún motivo todavía no la tiene (recién resuelta en
    // background), se ve este texto en vez de coordenadas. `lat`/`lng` sí
    // se siguen pasando (no se muestran como texto en ningún lado) porque
    // el drawer de detalle los usa para centrar el mini-mapa del hecho.
    ubicacion: row.direccion ?? 'Ubicación no disponible',
    lat: row.lat,
    lng: row.lng,
    epi: epiDeCodigo(row.epiCodigo),
    timestamp: toDDMMAAAAHHMM(row.ocurridoEn),
    // Solo el nombre — antes se concatenaba el UUID del guardia acá al
    // lado, que en pantalla se lee como un token/cadena sin sentido.
    reportante: row.guardiaNombre,
    estado: hechoEstadoDeApi(row.estado),
    tieneEvidencia: evs.length > 0,
    evidencias: evs.map((e) => ({
      id: e.id,
      url: e.url,
      tipo: e.tipo === 'video' ? 'video' : 'foto',
    })),
    narrativa: row.descripcion,
    // No existe un concepto de "unidad de respuesta" separado del guardia
    // que reporta (el hecho no se vincula a una patrulla en la BD) — mismo
    // motivo, antes mostraba el UUID crudo del guardia.
    unidadAsignada: row.guardiaNombre,
  };
}

function toDDMMAAAAHHMM(value: string | Date): string {
  const d = toApiDate(value);
  return `${toDDMMAAAA(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export const getHechosActivos = cache(async (): Promise<Hecho[]> => {
  const rows = await apiFetch<ApiHecho[]>('/api/hechos', { revalidate: 15 });
  return rows.map(rowToHechoApi);
});

export async function updateHechoEstado(id: string, estado: Hecho['estado']): Promise<void> {
  await apiFetch(`/api/hechos/${encodeURIComponent(id)}/estado`, {
    method: 'PATCH',
    body: { estado: HECHO_ESTADO_A_API[estado] },
  });
}

function formatRelative(value: string | Date): string {
  const diffSeconds = Math.max(0, Math.round((Date.now() - toApiDate(value).getTime()) / 1000));
  if (diffSeconds < 60) return `hace ${diffSeconds}s`;
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

// Unidad de patrullaje (agrupa guardias que comparten coche/moto/punto de
// servicio, Caso B/C de PatrolLayer/UnitPerimeterLines) — no existe como
// columna en `patrulla` real (types/patrulla.ts lo documenta). Se sostiene
// en memoria del proceso servidor mientras dure la sesión de trabajo del
// Operador: crearPatrulla() la escribe, getGuardMarkers() la lee. Se
// pierde al reiniciar el servidor — aceptable, es solo agrupación visual.
const UNIDAD_POR_GUARDIA = new Map<string, string>();

interface ApiUbicacionGuardia {
  guardiaId: string;
  guardiaNombre: string;
  epiCodigo: string | null;
  lat: number;
  lng: number;
  direccion: string | null;
  esSos: boolean;
  estadoOperativo: string;
  bateriaPct: number | null;
  capturadoEn: string;
  turnoInicio: string | null;
}

function formatHora(value: string | Date): string {
  const d = toApiDate(value);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Solo guardias con telemetría reciente (GPS real del móvil) aparecen como
// pin — GET /api/mapas/ubicaciones ya filtra a la última posición por
// guardia, pero esa última posición queda registrada aunque el guardia ya
// haya pasado a 'fuera_de_servicio' (el celular puede seguir reportando, o
// simplemente el pin es la última posición antes de terminar el turno) —
// bug reportado tras la defensa: un guardia fuera de servicio seguía
// visible en el Mapa de Patrullaje en Vivo. Se filtra acá (adaptador), no
// en PatrolLayer/PatrolRosterPanel, para que ningún consumidor del mapa
// tenga que repetir la regla. Se filtra también a los guardias dados de
// baja (accountStatus 'inactivo') por la misma razón — la API de
// ubicaciones no depende de si la cuenta sigue activa.
// `guardiasPrefetched` evita volver a pedir /api/guardias (+ /api/hechos)
// cuando el llamador ya los cargó en el mismo ciclo (ej. MapasView carga
// guardias y marcadores a la vez) — antes esta función siempre volvía a
// llamar a getGuardias() aunque el caller ya tuviera el resultado, duplicando
// 2 round-trips de red en cada carga/refresh del mapa.
export const getGuardMarkers = cache(async (guardiasPrefetched?: Guard[]): Promise<GuardMarker[]> => {
  const [ubicaciones, guardias] = await Promise.all([
    apiFetch<ApiUbicacionGuardia[]>('/api/mapas/ubicaciones', { revalidate: 5 }),
    guardiasPrefetched ?? getGuardias(),
  ]);
  const dadosDeBaja = new Set(guardias.filter((g) => g.accountStatus === 'inactivo').map((g) => g.id));
  const fotoPorGuardia = new Map(guardias.map((g) => [g.id, g.fotoUrl]));
  return ubicaciones
    // Una alerta SOS activa NUNCA debe ocultarse del mapa, sin importar el
    // estadoOperativo — antes un guardia con esSos=true pero ya marcado
    // 'fuera_de_servicio' (por la desincronización conocida entre ambos
    // campos) desaparecía del mapa en vez de mostrar la alerta.
    .filter((u) => (u.estadoOperativo !== 'fuera_de_servicio' || u.esSos) && !dadosDeBaja.has(u.guardiaId))
    .map((u) => ({
      id: u.guardiaId,
      label: u.guardiaNombre.split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase(),
      lat: u.lat,
      lng: u.lng,
      zone: epiDeCodigo(u.epiCodigo),
      hasSos: u.esSos || u.estadoOperativo === 'emergencia',
      nombre: u.guardiaNombre,
      fotoUrl: fotoPorGuardia.get(u.guardiaId) ?? undefined,
      operationalStatus: u.estadoOperativo as GuardMarker['operationalStatus'],
      // Nunca lat/lng crudos en pantalla (pedido explícito 2026-09-14).
      ubicacionActual: u.direccion ?? 'Ubicación no disponible',
      turnoInicio: u.turnoInicio ? formatHora(u.turnoInicio) : '—',
      turnoFin: '—',
      bateria: u.bateriaPct ?? 0,
      ultimoSync: formatRelative(u.capturadoEn),
      capturadoEnIso: toApiDate(u.capturadoEn).toISOString(),
      ruta: [],
      unidadId: UNIDAD_POR_GUARDIA.get(u.guardiaId),
    }));
});

interface ApiZona {
  id: string;
  epiId: string | null;
  epiCodigo: string | null;
  centroLat: number;
  centroLng: number;
  radioM: number | null;
  direccion: string | null;
  cantidadHechos: number;
  nivelRiesgo: string;
  ventanaHasta: string;
}

export const getZonasCriticas = cache(async (): Promise<ZonaCriticaActivaRow[]> => {
  const rows = await apiFetch<ApiZona[]>('/api/mapas/zonas', { revalidate: 60 });
  return rows
    .map((z) => ({
      id: z.id,
      centroLat: z.centroLat,
      centroLng: z.centroLng,
      direccionAproximada: z.direccion ?? '—',
      radioMetros: z.radioM ?? 400,
      conteoHechos: z.cantidadHechos,
      nivelRiesgoPredominante: z.nivelRiesgo as ZonaCriticaActivaRow['nivelRiesgoPredominante'],
      epiId: epiDeCodigo(z.epiCodigo),
      lastUpdated: toDDMMAAAAHHMM(z.ventanaHasta),
    }))
    .sort((a, b) => b.conteoHechos - a.conteoHechos);
});

interface ApiRuta {
  id: string;
  nombre: string;
  descripcion: string | null;
  epiCodigo: string | null;
  trazado: unknown;
  activo?: boolean;
}

// Una plantilla sin trazado válido (ej. fila vieja de antes del rediseño de
// rutas 2026-09-14, o el jsonb todavía en su forma de polígono anterior) no
// se descarta silenciosamente aquí — se filtra en el llamador si hace falta
// dibujarla, pero sigue apareciendo en listados de solo nombre/descripción.
// Formato real de `ruta_plantilla.trazado`: array de puntos [lng, lat]
// pelado — NO un objeto GeoJSON `{type,coordinates}` — porque la app móvil
// ya lee esta columna así en producción (`appmunicipal/src/api/patrullas.ts`).
function trazadoValido(raw: unknown): TrazadoPuntos | null {
  if (
    Array.isArray(raw) &&
    raw.length >= 2 &&
    raw.every((p) => Array.isArray(p) && p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number')
  ) {
    return raw as TrazadoPuntos;
  }
  return null;
}

export const getRutasPlantilla = cache(async (): Promise<RutaPlantillaRow[]> => {
  const rows = await apiFetch<ApiRuta[]>('/api/mapas/rutas', { revalidate: 60 });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion ?? undefined,
    epiId: epiDeCodigo(r.epiCodigo),
    trazado: trazadoValido(r.trazado) ?? [],
    activa: r.activo ?? true,
  }));
});

interface ApiPatrulla {
  id: string;
  nombre: string | null;
  descripcion: string | null;
  estado: string;
  guardiaId: string;
  asignadoPorId: string;
  rutaPlantillaId: string | null;
  // El backend ya embebe el nombre/trazado de la ruta compartida en cada
  // fila de patrulla (mapas.service.ts:patrullasVigentes hace el join) —
  // hace falta leerlo de ACÁ, no cruzarlo contra getRutasPlantilla(), porque
  // ese GET filtra `activo=true` (solo plantillas reutilizables) y una ruta
  // de una sola asignación (activo=false) nunca aparecería ahí aunque esté
  // perfectamente vigente para los guardias que la tienen asignada hoy.
  rutaNombre: string | null;
  trazado: unknown;
  poligonoGeojson: unknown;
  epiCodigo: string | null;
}

function rowToPatrullaApi(row: ApiPatrulla): PatrullaRow {
  return {
    id: row.id,
    guardiaId: row.guardiaId,
    operadorId: row.asignadoPorId,
    epiId: epiDeCodigo(row.epiCodigo),
    rutaPlantillaId: row.rutaPlantillaId ?? undefined,
    rutaNombre: row.rutaNombre ?? undefined,
    trazado: trazadoValido(row.trazado) ?? undefined,
    nombre: row.nombre ?? '',
    descripcion: row.descripcion ?? undefined,
    poligonoGeojson: (row.poligonoGeojson as GeoJsonPolygon | GeoJsonPoint | null) ?? { type: 'Polygon', coordinates: [] },
    estado: row.estado as PatrullaEstado,
    // modalidad no existe en la BD real (types/patrulla.ts) — no hay de
    // dónde leerla al recargar; 'coche' es el valor por defecto más común.
    modalidad: 'coche',
    unidadId: UNIDAD_POR_GUARDIA.get(row.guardiaId),
  };
}

export const getPatrullas = cache(async (): Promise<PatrullaRow[]> => {
  const rows = await apiFetch<ApiPatrulla[]>('/api/mapas/patrullas', { revalidate: 10 });
  return rows.map(rowToPatrullaApi);
});

export async function getPatrullaEnCurso(): Promise<PatrullaRow | null> {
  const rows = await getPatrullas();
  return rows.find((p) => p.estado === 'en_curso') ?? null;
}

// modalidad/unidadId no se envían al API (no existen en la BD real, ver
// types/patrulla.ts) — modalidad solo guía la capacidad del wizard;
// unidadId se guarda en UNIDAD_POR_GUARDIA para que el mapa siga
// agrupando visualmente a los guardias de la misma unidad.
export async function crearPatrulla(data: Omit<PatrullaRow, 'id' | 'estado'>): Promise<PatrullaRow> {
  const result = await apiFetch<ApiPatrulla>('/api/mapas/patrullas', {
    method: 'POST',
    body: {
      guardiaId: data.guardiaId,
      // epiId: se omite — el API lo toma del propio guardia si no se manda
      // (mapas.service.ts asignarPatrulla), y ahí es un uuid real, no el
      // slug de EpiZone que maneja el wizard.
      rutaPlantillaId: data.rutaPlantillaId ?? null,
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      poligonoGeojson: data.poligonoGeojson,
    },
  });
  if (data.unidadId) UNIDAD_POR_GUARDIA.set(data.guardiaId, data.unidadId);
  return { ...rowToPatrullaApi(result), modalidad: data.modalidad, unidadId: data.unidadId };
}

// POST /api/mapas/rutas (RF-G3-09, 2026-09-14) — `trazado` viaja como
// array de puntos [lng, lat] pelado (ver trazadoValido arriba), no como
// GeoJSON — mismo formato que ya lee la app móvil en producción.
export async function crearRutaPlantilla(data: Omit<RutaPlantillaRow, 'id'>): Promise<RutaPlantillaRow> {
  const result = await apiFetch<ApiRuta>('/api/mapas/rutas', {
    method: 'POST',
    body: {
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      trazado: data.trazado,
      activo: data.activa,
    },
  });
  return {
    id: result.id,
    nombre: result.nombre,
    descripcion: result.descripcion ?? undefined,
    epiId: epiDeCodigo(result.epiCodigo),
    trazado: trazadoValido(result.trazado) ?? data.trazado,
    activa: result.activo ?? data.activa,
  };
}

// Cancela una ruta compartida (RF-G3-09, 2026-09-14): todos los guardias
// vigentes en esa rutaPlantillaId quedan 'cancelada' de un solo golpe — el
// Operador cancela LA RUTA (el trazado compartido), no a un guardia
// individual. El guardia sigue apareciendo en el Mapa de Patrullaje en Vivo
// (su pin depende solo de telemetría/estadoOperativo, nunca de la ruta) —
// lo que desaparece es la línea de la ruta y su agrupación en el panel.
export async function cancelarRuta(rutaPlantillaId: string): Promise<{ rutaPlantillaId: string; cancelados: number }> {
  return apiFetch(`/api/mapas/rutas/${encodeURIComponent(rutaPlantillaId)}/cancelar`, { method: 'PATCH' });
}

// Complemento (2026-09-14): saca a UN guardia de una ruta compartida sin
// tocar a los demás — `patrullaId` es la fila propia de ese guardia dentro
// de la ruta (PatrullaRow.id, no el id de la ruta).
export async function cancelarPatrulla(patrullaId: string): Promise<{ patrullaId: string; guardiaId: string }> {
  return apiFetch(`/api/mapas/patrullas/${encodeURIComponent(patrullaId)}/cancelar`, { method: 'PATCH' });
}

export interface HeatmapPoint { lat: number; lng: number; nivelRiesgo: string }

export async function getHeatmap(params: { desde?: string; hasta?: string; epiId?: string } = {}): Promise<HeatmapPoint[]> {
  const qs = new URLSearchParams();
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  if (params.epiId) qs.set('epiId', params.epiId);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiFetch<HeatmapPoint[]>(`/api/mapas/heatmap${suffix}`);
}

// ---------------------------------------------------------------------------
// USUARIOS (web: Super Admin/Admin/Operador) — conectado a /api/usuarios.
// ---------------------------------------------------------------------------

interface ApiUser {
  id: string;
  primerNombre: string;
  segundoNombre: string | null;
  apellidoPaterno: string;
  apellidoMaterno: string;
  roleCodigo: string;
  email: string;
  ci: string | null;
  telefono: string | null;
  estado: string;
  debeCambiarPassword: boolean;
  creadoPorNombre: string | null;
  createdAt: string;
}

function rowToUserApi(row: ApiUser): UserRow {
  return {
    id: row.id,
    email: row.email,
    roleId: row.roleCodigo,
    role: row.roleCodigo as UserRow['role'],
    estado: (row.estado === 'suspendido' ? 'bloqueado' : row.estado) as UserRow['estado'],
    primerLoginRequerido: row.debeCambiarPassword,
    createdBy: row.creadoPorNombre,
    createdAt: toDDMMAAAA(row.createdAt),
    primerNombre: row.primerNombre,
    segundoNombre: row.segundoNombre ?? undefined,
    apellidoPaterno: row.apellidoPaterno,
    apellidoMaterno: row.apellidoMaterno,
    telefono: row.telefono ?? undefined,
  };
}

export async function getUsuarios(): Promise<UserRow[]> {
  const rows = await apiFetch<ApiUser[]>('/api/usuarios');
  return rows.map(rowToUserApi);
}

export async function getUsuarioByEmail(email: string): Promise<UserRow | null> {
  const users = await getUsuarios();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Mutaciones de guardia — invocadas por los Server Actions de
// features/guardias/actions/ luego de validar el rol (nunca directo desde
// un componente cliente).
// ---------------------------------------------------------------------------

export async function updateGuardiaEstado(id: string, estado: GuardiaRow['estado']): Promise<Guard | null> {
  if (estado === 'pendiente_activacion') return getGuardiaById(id);
  const row = await apiFetch<ApiGuardia | null>(`/api/guardias/${encodeURIComponent(id)}/estado`, {
    method: 'PATCH',
    body: { estado },
  });
  return row ? rowToGuardApi(row, 0) : null;
}

// Estado operativo (en_servicio/fuera_de_servicio/emergencia) — distinto del
// estado de cuenta de arriba (guardia.estado_operativo, no guardia.estado).
// Lo usa el Operador desde el Mapa para resolver un SOS (volver a
// 'en_servicio') y assignRoute.ts como red de seguridad si se asigna una
// ruta a un guardia que sigue en SOS.
export async function updateGuardiaEstadoOperativo(id: string, estadoOperativo: Guard['operationalStatus']): Promise<Guard | null> {
  const row = await apiFetch<ApiGuardia | null>(`/api/guardias/${encodeURIComponent(id)}/estado-operativo`, {
    method: 'PATCH',
    body: { estadoOperativo },
  });
  return row ? rowToGuardApi(row, 0) : null;
}

export async function updateGuardiaBiografia(
  id: string,
  patch: Partial<Pick<GuardiaRow, 'primerNombre' | 'segundoNombre' | 'apellidoPaterno' | 'apellidoMaterno' | 'telefono' | 'epiId'>>,
): Promise<Guard | null> {
  const row = await apiFetch<ApiGuardia | null>(`/api/guardias/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: {
      ...(patch.primerNombre !== undefined ? { primerNombre: patch.primerNombre } : {}),
      ...(patch.segundoNombre !== undefined ? { segundoNombre: patch.segundoNombre } : {}),
      ...(patch.apellidoPaterno !== undefined ? { apellidoPaterno: patch.apellidoPaterno } : {}),
      ...(patch.apellidoMaterno !== undefined ? { apellidoMaterno: patch.apellidoMaterno } : {}),
      ...(patch.telefono !== undefined ? { telefono: patch.telefono } : {}),
      ...(patch.epiId !== undefined ? { epiCodigo: EPI_SLUG_A_CODIGO[patch.epiId as EpiZone] ?? null } : {}),
    },
  });
  return row ? rowToGuardApi(row, 0) : null;
}

interface ApiGuardiaCreated {
  guardia: ApiGuardia;
  usuario: string;
  passwordTemporal: string;
}

// Alta de guardia — usuario/contraseña los genera el API (mismo criterio
// que muestra la pantalla de confirmación, MASTER.md sección 14.2).
export async function crearGuardia(data: {
  primerNombre: string;
  segundoNombre?: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  ci: string;
  fechaNacimiento: string;
  telefono: string;
  epi: EpiZone;
  createdBy: string;
}): Promise<{ guardia: Guard; usuario: string; passwordTemporal: string }> {
  const result = await apiFetch<ApiGuardiaCreated>('/api/guardias', {
    method: 'POST',
    body: {
      primerNombre: data.primerNombre,
      segundoNombre: data.segundoNombre ?? null,
      apellidoPaterno: data.apellidoPaterno,
      apellidoMaterno: data.apellidoMaterno,
      ci: data.ci,
      telefono: data.telefono,
      fechaNacimiento: data.fechaNacimiento,
      epiCodigo: EPI_SLUG_A_CODIGO[data.epi],
    },
  });
  return { guardia: rowToGuardApi(result.guardia, 0), usuario: result.usuario, passwordTemporal: result.passwordTemporal };
}

interface ApiUserCreated {
  user: ApiUser;
  temporaryPassword: string;
}

// Alta de Operador/Administrador — mismo formulario/lógica que Guardia,
// pero el identificador único es el correo (no CI) y la contraseña
// temporal es aleatoria (la genera el API), no la fecha de nacimiento.
export async function crearUsuario(data: {
  primerNombre: string;
  segundoNombre?: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono: string;
  email: string;
  role: UserRow['role'];
  createdBy: string;
}): Promise<{ usuario: UserRow; passwordTemporal: string }> {
  const result = await apiFetch<ApiUserCreated>('/api/usuarios', {
    method: 'POST',
    body: {
      rol: data.role,
      primerNombre: data.primerNombre,
      segundoNombre: data.segundoNombre ?? null,
      apellidoPaterno: data.apellidoPaterno,
      apellidoMaterno: data.apellidoMaterno,
      // El API exige un `usuario` único (tabla user.usuario); el diseño usa
      // la parte local del email (MASTER.md §15.4, asunción sin confirmar).
      usuario: data.email.split('@')[0] ?? data.email,
      telefono: data.telefono,
      email: data.email,
    },
  });
  return { usuario: rowToUserApi(result.user), passwordTemporal: result.temporaryPassword };
}

// ---------------------------------------------------------------------------
// DASHBOARD — KPIs y series agregadas, conectado a /api/dashboard.
// ---------------------------------------------------------------------------

const ZONA_A_SLUG: Record<string, EpiZone> = {
  norte: 'norte',
  central: 'central',
  sud: 'sud',
  'coña coña': 'cona',
  cona: 'cona',
  'centro cercado': 'centro',
};

function zonaASlug(zona: string | null): EpiZone {
  const key = (zona ?? '').toLowerCase().replace(/^epi\s+/, '').trim();
  return ZONA_A_SLUG[key] ?? 'centro';
}

function dayShort(dia: string): string {
  const d = new Date(`${dia}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dia;
  const label = d.toLocaleDateString('es-BO', { weekday: 'short' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function withPercentage(items: { label: string; total: number }[]): { label: string; total: number; percentage: number }[] {
  const sum = items.reduce((acc, i) => acc + i.total, 0);
  return items.map((i) => ({ ...i, percentage: sum > 0 ? Math.round((i.total / sum) * 100) : 0 }));
}

export const getDashboardKpis = cache(async (): Promise<{
  hechosHoy: number;
  hechosEnRevision: number;
  guardiasEnServicio: number;
  sosPendientes: number;
}> => {
  return apiFetch('/api/dashboard/kpi', { revalidate: 10 });
});

export const getDashboardHechosPorDia = cache(async (dias = 7): Promise<HechoPorDiaPoint[]> => {
  const rows = await apiFetch<{ dia: string; total: number }[]>(`/api/dashboard/series/deficit?dias=${dias}`, { revalidate: 30 });
  return rows.map((r) => ({ day: dayShort(r.dia), total: r.total, rawDia: r.dia }));
});

export const getDashboardHechosPorTipo = cache(async (): Promise<HechoPorTipoItem[]> => {
  const rows = await apiFetch<{ tipo: string; total: number }[]>('/api/dashboard/series/por-tipo', { revalidate: 30 });
  return withPercentage(rows.map((r) => ({ label: r.tipo, total: r.total }))).map((i) => ({
    tipo: i.label,
    total: i.total,
    percentage: i.percentage,
  }));
});

export const getDashboardHechosPorZona = cache(async (): Promise<HechoPorZonaItem[]> => {
  const rows = await apiFetch<{ zona: string | null; total: number }[]>('/api/dashboard/series/por-zona', { revalidate: 30 });
  return withPercentage(rows.map((r) => ({ label: r.zona ?? 'Sin EPI', total: r.total }))).map((i) => ({
    zone: zonaASlug(i.label),
    total: i.total,
    percentage: i.percentage,
  }));
});

export interface AppNotification { id: string; title: string; timestamp: string; read?: boolean; guardiaId?: string; hechoId?: string; kind: 'sos' | 'bateria' | 'hecho' }

export const getNotificaciones = cache(async (limit = 10): Promise<AppNotification[]> => {
  try {
    const [ubicaciones, hechos] = await Promise.all([
      apiFetch<ApiUbicacionGuardia[]>('/api/mapas/ubicaciones', { revalidate: 10 }).catch(() => [] as ApiUbicacionGuardia[]),
      apiFetch<ApiHecho[]>('/api/hechos', { revalidate: 15 }).catch(() => [] as ApiHecho[]),
    ]);
    const sos = ubicaciones.filter((u) => u.esSos).slice(0, 5);
    const hechosRecientes = hechos.filter((h) => h.estado === 'reportado' || h.estado === 'en_revision').slice(0, 5);
    const list: AppNotification[] = [
      ...sos.map((u) => ({
        id: `sos-${u.guardiaId}`,
        title: `SOS — ${u.guardiaNombre} (${u.epiCodigo ?? '—'})`,
        timestamp: formatRelative(u.capturadoEn),
        read: false,
        guardiaId: u.guardiaId,
        kind: 'sos' as const,
      })),
      ...hechosRecientes.map((h) => ({
        id: h.id,
        title: `${h.tipoLabel}: ${h.descripcion.slice(0, 50)}`,
        timestamp: toDDMMAAAAHHMM(h.ocurridoEn),
        read: false,
        hechoId: h.id,
        guardiaId: h.guardiaId,
        kind: 'hecho' as const,
      })),
    ];
    const bateriaBaja = ubicaciones.filter((u) => (u.bateriaPct ?? 100) < 20).slice(0, 3);
    for (const b of bateriaBaja) {
      list.push({ id: `bat-${b.guardiaId}`, title: `Batería baja — ${b.guardiaNombre} (${b.bateriaPct}%)`, timestamp: formatRelative(b.capturadoEn), read: false, guardiaId: b.guardiaId, kind: 'bateria' as const });
    }
    return list.slice(0, limit);
  } catch {
    return [];
  }
});
