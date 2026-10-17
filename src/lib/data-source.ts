'use server';

import { cache } from 'react';
import type { EpiInfo, EpiZone } from '@/types/epi';
import type { UserRow } from '@/types/user';
import type { GuardiaRow } from '@/types/guardia';
import type { PatrullaRow, RutaPlantillaRow, GeoJsonPolygon, GeoJsonPoint, TrazadoPuntos, PatrullaEstado, EjecucionInfo, EstadoRuta, PatrullaModalidad, TipoRuta } from '@/types/patrulla';
import type { ZonaCriticaActivaRow } from '@/types/hecho';
import type { PuntoFijoRow } from '@/types/puntoFijo';
import type { AvisoProgramacion, EstadoPlanificador, HorarioAgenda, IntentosAutomaticos, ProgramacionBody, ProgramacionRow } from '@/types/programacion';
import type { Guard } from '@/features/guardias/types';
import type { Hecho } from '@/features/hechos/types';
import type { GuardMarker } from '@/features/mapas/types';
import type { HechoPorDiaPoint, HechoPorTipoItem, HechoPorZonaItem } from '@/features/dashboard/types';
import { revalidateTag } from 'next/cache';
import { apiFetch, apiFetchPage } from '@/lib/api/http';
import { getServerSession } from '@/lib/auth-session';
import type { EpiJurisdiccion, Jurisdiccion } from '@/features/mapas/lib/jurisdiccion';

// Tags de revalidación on-demand (Next.js Data Cache). Los GET con
// `revalidate: N` quedan cacheados N segundos SIN importar que llegue un
// push por socket o que el propio Operador dispare una mutación — antes
// ninguna Server Action invalidaba ese cache, así que después de resolver
// un SOS o cambiar el estado de un hecho, la siguiente lectura (incluso la
// disparada por el evento realtime) podía devolver la respuesta vieja
// hasta que el TTL expirara solo. Bug reportado 2026-09-19: la modal de
// resolución de SOS "parpadeaba"/reaparecía y el aviso tardaba en
// desaparecer — exactamente ese cache sirviendo datos viejos. Cada
// mutación de abajo revalida los tags de lo que pudo cambiar.
const TAGS = {
  guardias: 'guardias',
  hechos: 'hechos',
  ubicaciones: 'ubicaciones',
  patrullas: 'patrullas',
  rutas: 'rutas',
  puntosFijos: 'puntos-fijos',
  programacion: 'programacion',
  dashboardKpi: 'dashboard-kpi',
  epis: 'epis',
} as const;

// ---------------------------------------------------------------------------
// Guardias / Usuarios / Dashboard — conectados al backend real (gamc-api).
// Mapas y Hechos siguen sobre los mocks de abajo (*_DB) hasta que se
// resuelva el fork con la rama del compañero en esos dos módulos.
// ---------------------------------------------------------------------------

// Catálogo EPI dinámico: la Web usa el MISMO código que el
// backend (`sud`, `jaihuayco`, `cona_cona`…). Antes traducía a slugs propios
// (`cona`, `centro`) con dos tablas fijas: un código nuevo caía en "Centro"
// y los filtros mandaban slugs que el backend no conocía (HTTP 500).
function epiDeCodigo(codigo: string | null | undefined): EpiZone | null {
  return codigo || null;
}

// Cambia solo con una migración: caché larga, invalidable por tag.
export async function getEpiCatalogo(): Promise<EpiInfo[]> {
  return apiFetch<EpiInfo[]>('/api/epis', { revalidate: 300, tags: [TAGS.epis] });
}

export interface ModuloPolicial {
  id: string;
  codigo: string;
  nombre: string;
  epiCodigo: EpiZone;
  direccion: string | null;
  zona: string | null;
  lat: number;
  lng: number;
  coordenadasAproximadas: boolean;
  telefono: string | null;
  estado: string | null;
}

export async function getModulosPoliciales(): Promise<ModuloPolicial[]> {
  return apiFetch<ModuloPolicial[]>('/api/epis/modulos', { revalidate: 300, tags: [TAGS.epis] });
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
  // Formatear siempre en America/La_Paz para que coincida con el backend (hoyInicio/KPIs).
  // getDate/getMonth usan TZ del servidor (UTC en Render) y desplazaban 1 día.
  const parts = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const year = parts.find((p) => p.type === 'year')?.value ?? '1970';
  return `${day}/${month}/${year}`;
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

interface ApiEpiActual {
  epiCodigo: string | null;
  epiNombre: string | null;
  estado: 'asignada' | 'ambigua' | 'fuera_cobertura';
  frescura: 'reciente' | 'antigua';
  capturadoEn: string;
  desde: string;
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
  /** F3 */
  epiActual?: ApiEpiActual | null;
  /** F3: hechos del guardia dentro del alcance de quien consulta (calculado en el backend). */
  hechosCount?: number;
}

function rowToGuardApi(row: ApiGuardia): Guard {
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
    epiActual: row.epiActual
      ? {
          codigo: epiDeCodigo(row.epiActual.epiCodigo),
          nombre: row.epiActual.epiNombre,
          estado: row.epiActual.estado,
          frescura: row.epiActual.frescura,
          capturadoEnIso: toApiDate(row.epiActual.capturadoEn).toISOString(),
          desdeIso: toApiDate(row.epiActual.desde).toISOString(),
        }
      : null,
    reportesCount: row.hechosCount ?? 0,
    fotoUrl: row.fotoUrl ?? undefined,
    // Nunca lat/lng crudos en pantalla (pedido explícito 2026-09-14) — si
    // hay ubicación pero todavía no se resolvió la dirección (Nominatim en
    // background, ver geocoding.service.ts), se ve este texto en vez de
    // coordenadas. `undefined` se mantiene solo cuando el guardia nunca
    // reportó ubicación (caso distinto, sin dato en absoluto).
    ubicacionActual: row.ubicacion ? (row.ubicacion.direccion ?? 'Ubicación no disponible') : undefined,
  };
}

// F3: el conteo de reportes por guardia lo calcula el backend dentro del
// alcance (antes se contaba aquí sobre una página de 200 hechos).
export const getGuardias = cache(async (): Promise<Guard[]> => {
  const guardias = await apiFetch<ApiGuardia[]>('/api/guardias', { revalidate: 15, tags: [TAGS.guardias] });
  return guardias.map(rowToGuardApi);
});

export interface GuardiasPageParams {
  page: number;
  pageSize: number;
  q?: string;
  epiCodigo?: string;
  /** F3: EPI actual (código), 'fuera_cobertura' o 'sin_dato'. */
  epiActual?: string;
  estadoOperativo?: string;
  estado?: string;
}

// Variante paginada de getGuardias — la tabla de /guardias ya no trae la
// base completa en cada carga/refresh (pedido explícito 2026-09-19: "falta
// paginación... tardan demasiado"). El backend ya ordena en_servicio /
// emergencia primero (ver listGuardias), así que acá no hace falta
// reordenar. reportesPorGuardia sigue viniendo de /api/hechos completo
// (tope real 500, mismo límite que ya tenía esta cuenta antes) — no hay
// forma barata de agregarlo por guardia sin un endpoint de agregación
// nuevo, y no es el costo que hacía lenta esta pantalla.
export async function getGuardiasPage(params: GuardiasPageParams): Promise<{ rows: Guard[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  if (params.q) qs.set('q', params.q);
  if (params.epiCodigo) qs.set('epiCodigo', params.epiCodigo);
  if (params.epiActual) qs.set('epiActual', params.epiActual);
  if (params.estadoOperativo) qs.set('estadoOperativo', params.estadoOperativo);
  if (params.estado) qs.set('estado', params.estado);
  // La tabla principal de Guardias nunca muestra dados de baja (regla que
  // antes vivía solo en isDadoDeBaja, client-side sobre la lista completa).
  else qs.set('excluirInactivos', '1');

  const { data: guardias, total } = await apiFetchPage<ApiGuardia[]>(`/api/guardias?${qs.toString()}`, { tags: [TAGS.guardias] });
  return { rows: guardias.map(rowToGuardApi), total };
}

export async function getGuardiaById(id: string): Promise<Guard | null> {
  const row = await apiFetch<ApiGuardia | null>(`/api/guardias/${encodeURIComponent(id)}`);
  return row ? rowToGuardApi(row) : null;
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
  /** F3 */
  epiEstado?: string | null;
  epiMetodo?: string | null;
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
    epiEstado: (row.epiEstado as Hecho['epiEstado']) ?? undefined,
    epiMetodo: row.epiMetodo ?? undefined,
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
  if (Number.isNaN(d.getTime())) return '—';
  // Fecha + hora en America/La_Paz (consistente con hoyInicio del backend)
  const datePart = toDDMMAAAA(d);
  const timeParts = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hh = timeParts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = timeParts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${datePart} ${hh}:${mm}`;
}

export const getHechosActivos = cache(async (): Promise<Hecho[]> => {
  const rows = await apiFetch<ApiHecho[]>('/api/hechos', { revalidate: 15, tags: [TAGS.hechos] });
  return rows.map(rowToHechoApi);
});

export interface HechosPageParams {
  page: number;
  pageSize: number;
  q?: string;
  /** Vocabulario de la vista (abierto/en_proceso/resuelto) — se traduce antes de llamar al API. */
  estado?: Hecho['estado'];
  nivelRiesgo?: Hecho['severidad'];
  /** F3: 'pendiente' = bandeja de supervisión (EPI ambigua o fuera de cobertura). */
  clasificacion?: 'pendiente';
}

// Variante paginada de getHechosActivos — mismo motivo que
// getGuardiasPage: la tabla de /hechos (Reportes) traía la lista entera
// del backend (hasta 200 filas) en cada carga/refresh para después
// paginar en el navegador.
export async function getHechosPage(params: HechosPageParams): Promise<{ rows: Hecho[]; total: number }> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('pageSize', String(params.pageSize));
  if (params.q) qs.set('q', params.q);
  if (params.estado) qs.set('estado', HECHO_ESTADO_A_API[params.estado]);
  if (params.nivelRiesgo) qs.set('nivelRiesgo', params.nivelRiesgo);
  if (params.clasificacion) qs.set('clasificacion', params.clasificacion);

  const { data: rows, total } = await apiFetchPage<ApiHecho[]>(`/api/hechos?${qs.toString()}`, { tags: [TAGS.hechos] });
  return { rows: rows.map(rowToHechoApi), total };
}

/**
 * F3: TODOS los hechos que cumplen el filtro, dentro del alcance del
 * usuario, en orden estable. Antes la exportación pedía una página "grande"
 * que el backend recortaba a 100/200 filas. `truncado` avisa si se superó el
 * tope del backend (no se corta en silencio).
 */
export async function getHechosExport(params: Omit<HechosPageParams, 'page' | 'pageSize'> = {}): Promise<{ rows: Hecho[]; total: number; truncado: boolean }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.estado) qs.set('estado', HECHO_ESTADO_A_API[params.estado]);
  if (params.nivelRiesgo) qs.set('nivelRiesgo', params.nivelRiesgo);
  if (params.clasificacion) qs.set('clasificacion', params.clasificacion);
  const { data: rows, total, truncado } = await apiFetchPage<ApiHecho[]>(`/api/hechos/exportar?${qs.toString()}`, { tags: [TAGS.hechos] });
  return { rows: rows.map(rowToHechoApi), total, truncado };
}

/** F3: la supervisión global decide la EPI de un hecho pendiente (o la corrige). */
export async function clasificarHecho(id: string, epiCodigo: string): Promise<void> {
  await apiFetch(`/api/hechos/${encodeURIComponent(id)}/epi`, { method: 'PATCH', body: { epiCodigo } });
  revalidateTag(TAGS.hechos);
  revalidateTag(TAGS.dashboardKpi);
}

export async function updateHechoEstado(id: string, estado: Hecho['estado']): Promise<void> {
  await apiFetch(`/api/hechos/${encodeURIComponent(id)}/estado`, {
    method: 'PATCH',
    body: { estado: HECHO_ESTADO_A_API[estado] },
  });
  revalidateTag(TAGS.hechos);
  revalidateTag(TAGS.dashboardKpi);
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
// servicio, Caso B de PatrolLayer) — no existe como
// columna en `patrulla` real (types/patrulla.ts lo documenta). Se sostiene
// en memoria del proceso servidor mientras dure la sesión de trabajo del
// Operador: crearPatrulla() la escribe, getGuardMarkers() la lee. Se
// pierde al reiniciar el servidor — aceptable, es solo agrupación visual.

interface ApiUbicacionGuardia {
  guardiaId: string;
  guardiaNombre: string;
  epiCodigo: string | null;
  lat: number;
  lng: number;
  direccion: string | null;
  esSos: boolean;
  /** F2: hay alertas SOS sin atender (definición única del backend). */
  sosAbierto?: boolean;
  sosAlertaIds?: string[];
  estadoOperativo: string;
  bateriaPct: number | null;
  capturadoEn: string;
  turnoInicio: string | null;
  /** F3 */
  epiActual?: { codigo: string | null; nombre: string | null; estado: string; frescura: string } | null;
  asignacion?: { propia: boolean; epiCodigo: string | null; ejecucionId: string | null; rutaNombre: string | null } | null;
}

function formatHora(value: string | Date): string {
  const d = toApiDate(value);
  if (Number.isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hh}:${mm}`;
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
  const [ubicaciones, guardias, patrullas] = await Promise.all([
    apiFetch<ApiUbicacionGuardia[]>('/api/mapas/ubicaciones', { revalidate: 15, tags: [TAGS.ubicaciones] }),
    guardiasPrefetched ?? getGuardias(),
    apiFetch<ApiPatrulla[]>('/api/mapas/patrullas', { revalidate: 20, tags: [TAGS.patrullas] }).catch(() => [] as ApiPatrulla[]),
  ]);
  const dadosDeBaja = new Set(guardias.filter((g) => g.accountStatus === 'inactivo').map((g) => g.id));
  const fotoPorGuardia = new Map(guardias.map((g) => [g.id, g.fotoUrl]));
  const patrullaPorGuardia = new Map(patrullas.map((p) => [p.guardiaId, p]));
  // Un SOS abierto SIEMPRE se muestra (F2): aunque el guardia figure fuera de
  // servicio o su cuenta se haya dado de baja después de la alerta.
  return ubicaciones
    .filter((u) => u.sosAbierto || (u.estadoOperativo !== 'fuera_de_servicio' && !dadosDeBaja.has(u.guardiaId)))
    .map((u) => {
      const patrulla = patrullaPorGuardia.get(u.guardiaId);
      let rutaAsignada: GuardMarker['rutaAsignada'] | undefined;
      const trazado = trazadoValido(patrulla?.trazado);
      if (patrulla && trazado) {
        rutaAsignada = {
          nombre: patrulla.rutaNombre ?? patrulla.nombre ?? 'Ruta sin nombre',
          color: '#A97F52',
          puntos: trazado.map(([lng, lat]) => ({ lat, lng })),
        };
      }
      const modalidad = patrulla?.modalidad ?? patrulla?.ejecucion?.modalidad;
      return ({
        id: u.guardiaId,
        label: u.guardiaNombre.split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase(),
        lat: u.lat,
        lng: u.lng,
        // F3: el pin se colorea por la EPI donde está AHORA (GPS); la de la cuenta solo si no se sabe.
        zone: epiDeCodigo(u.epiActual?.codigo ?? u.epiCodigo),
        ocupacion: u.asignacion
          ? { propia: u.asignacion.propia, epiCodigo: epiDeCodigo(u.asignacion.epiCodigo), rutaNombre: u.asignacion.rutaNombre }
          : null,
        hasSos: Boolean(u.sosAbierto) || u.estadoOperativo === 'emergencia',
        sosAlertaIds: u.sosAlertaIds ?? [],
        estadoRuta: patrulla?.estadoRuta ?? null,
        distanciaRutaM: patrulla?.distanciaRutaM ?? null,
        incorporadaEn: patrulla?.incorporadaEn ?? null,
        incorporacionLimite: patrulla?.incorporacionLimite ?? null,
        ejecucionId: patrulla?.ejecucionId ?? undefined,
        nombre: u.guardiaNombre,
        fotoUrl: fotoPorGuardia.get(u.guardiaId) ?? undefined,
        operationalStatus: u.estadoOperativo as GuardMarker['operationalStatus'],
        ubicacionActual: u.direccion ?? `${u.lat.toFixed(4)}, ${u.lng.toFixed(4)}`,
        turnoInicio: u.turnoInicio ? formatHora(u.turnoInicio) : '—',
        turnoFin: '—',
        bateria: u.bateriaPct,
        ultimoSync: formatRelative(u.capturadoEn),
        capturadoEnIso: toApiDate(u.capturadoEn).toISOString(),
        gpsSinActualizacionSeg: Math.round((Date.now() - new Date(u.capturadoEn).getTime()) / 1000),
        ruta: [],
        // Unidad = la ejecución, solo si viajan juntos (coche/moto).
        unidadId: patrulla?.ejecucionId && (modalidad === 'coche' || modalidad === 'moto') ? patrulla.ejecucionId : undefined,
        direccionActual: u.direccion ?? undefined,
        ...(rutaAsignada ? { rutaAsignada } : {}),
      });
    });
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
  modalidad?: string;
  tipo?: string;
  creadaEn?: string;
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
  const rows = await apiFetch<ApiRuta[]>('/api/mapas/rutas', { revalidate: 60, tags: [TAGS.rutas] });
  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    descripcion: r.descripcion ?? undefined,
    epiId: epiDeCodigo(r.epiCodigo),
    trazado: trazadoValido(r.trazado) ?? [],
    activa: r.activo ?? true,
    modalidad: r.modalidad as RutaPlantillaRow['modalidad'],
    tipo: (r.tipo as TipoRuta | undefined) ?? 'guardada',
    creadaEn: r.creadaEn,
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
  rutaNombre: string | null;
  trazado: unknown;
  poligonoGeojson: unknown;
  epiCodigo: string | null;
  direccionActual?: string;
  ejecucionId?: string | null;
  ejecucion?: EjecucionInfo | null;
  modalidad?: string | null;
  estadoRuta?: EstadoRuta | null;
  distanciaRutaM?: number | null;
  incorporadaEn?: string | null;
  incorporacionLimite?: string | null;
  puntoFijo?: { id: string; nombre: string; esSubpunto: boolean } | null;
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
    // Antes siempre 'coche' (no se guardaba); desde F2 viene de la ejecución.
    modalidad: ((row.modalidad ?? row.ejecucion?.modalidad) as PatrullaModalidad | undefined) ?? 'coche',
    unidadId: row.ejecucion?.unidad ?? undefined,
    direccionActual: row.direccionActual,
    ejecucionId: row.ejecucionId ?? undefined,
    ejecucion: row.ejecucion ?? null,
    estadoRuta: row.estadoRuta ?? null,
    distanciaRutaM: row.distanciaRutaM ?? null,
    incorporadaEn: row.incorporadaEn ?? null,
    incorporacionLimite: row.incorporacionLimite ?? null,
    puntoFijo: row.puntoFijo ?? null,
  };
}

export const getPatrullas = cache(async (): Promise<PatrullaRow[]> => {
  const rows = await apiFetch<ApiPatrulla[]>('/api/mapas/patrullas', { revalidate: 10, tags: [TAGS.patrullas] });
  return rows.map(rowToPatrullaApi);
});

export async function getPatrullaEnCurso(): Promise<PatrullaRow | null> {
  const rows = await getPatrullas();
  return rows.find((p) => p.estado === 'en_curso') ?? null;
}

// Motor de asignación (F2): UNA intención por operación — el backend valida
// el lote completo y asigna todo o nada (antes la web creaba una patrulla por
// guardia en un bucle y un fallo a mitad dejaba la ruta a medias).
export interface AsignacionBody {
  claveIdempotencia: string;
  ejecucionId?: string;
  rutaPlantillaId?: string;
  /** F4: asignar a un punto fijo del catálogo (punto o subpunto). */
  puntoFijoId?: string;
  nueva?: { nombre: string; descripcion?: string | null; trazado: TrazadoPuntos; tipo: TipoRuta };
  modalidad?: PatrullaModalidad;
  nombre?: string | null;
  descripcion?: string | null;
  unidad?: string | null;
  /** `puntoFijoId` por guardia: subpunto elegido (si no, el backend elige el de más cupo). */
  guardias: { guardiaId: string; punto?: [number, number] | null; puntoFijoId?: string | null }[];
  confirmaciones?: { guardiaId: string; patrullaId: string }[];
}

export interface ConflictoAsignacion {
  guardiaId: string;
  guardiaNombre: string;
  patrullaId: string;
  ejecucionId: string | null;
  /** null si la ruta es de otra jurisdicción (no se revela). */
  rutaNombre: string | null;
  mismaJurisdiccion: boolean;
  confirmable: boolean;
}

export interface AvisoAsignacion {
  guardiaId: string;
  tipo: 'gps_antiguo' | 'sin_gps';
  mensaje: string;
}

/** Guardia que no quedó asignado y por qué (la asignación es parcial). */
export interface NoAsignado {
  guardiaId: string;
  guardiaNombre: string;
  motivo: 'no_existe' | 'cuenta_inactiva' | 'sos' | 'sin_turno' | 'otra_epi' | 'en_ruta_otra_epi' | 'ya_en_esta_ruta' | 'ruta_llena' | 'punto_lleno';
  mensaje: string;
}

export interface PrevisualizacionAsignacion {
  conflictos: ConflictoAsignacion[];
  noAsignados: NoAsignado[];
  avisos: AvisoAsignacion[];
}

/** Antes de dibujar la ruta: quién ya tiene ruta, quién no podrá asignarse y avisos de GPS. */
export async function previsualizarAsignacion(body: { guardias: { guardiaId: string }[]; ejecucionId?: string; puntoFijoId?: string }): Promise<PrevisualizacionAsignacion> {
  return apiFetch('/api/mapas/ejecuciones/previsualizar', { method: 'POST', body });
}

export interface ResultadoAsignacion {
  ejecucion: { id: string; nombre: string };
  patrullaIds: string[];
  noAsignados: NoAsignado[];
  avisos: AvisoAsignacion[];
}

export async function asignarEjecucion(body: AsignacionBody): Promise<ResultadoAsignacion> {
  const result = await apiFetch<ResultadoAsignacion>('/api/mapas/ejecuciones', { method: 'POST', body });
  revalidateTag(TAGS.patrullas);
  revalidateTag(TAGS.ubicaciones);
  revalidateTag(TAGS.guardias);
  revalidateTag(TAGS.rutas);
  revalidateTag(TAGS.puntosFijos);
  revalidateTag(TAGS.programacion);
  return result;
}

// --- Puntos fijos (F4) -------------------------------------------------------
// Ocupación autoritativa del backend; caché corta porque cambia con cada
// asignación (las mutaciones revalidan el tag).
export async function getPuntosFijos(opciones: { incluirInactivos?: boolean } = {}): Promise<PuntoFijoRow[]> {
  const qs = opciones.incluirInactivos ? '?incluirInactivos=1' : '';
  return apiFetch<PuntoFijoRow[]>(`/api/puntos-fijos${qs}`, { revalidate: 10, tags: [TAGS.puntosFijos] });
}

export interface PuntoFijoBody {
  nombre?: string;
  descripcion?: string | null;
  lat?: number;
  lng?: number;
  capacidad?: number;
  padreId?: string | null;
  epiCodigo?: string | null;
  coordenadasAproximadas?: boolean;
  activo?: boolean;
  politicaOcupados?: 'trasladar' | 'retirar';
  motivo?: string | null;
}

export async function crearPuntoFijo(body: PuntoFijoBody): Promise<{ id: string }> {
  const r = await apiFetch<{ id: string }>('/api/puntos-fijos', { method: 'POST', body });
  revalidateTag(TAGS.puntosFijos);
  return r;
}

export async function actualizarPuntoFijo(id: string, body: PuntoFijoBody): Promise<{ politica: string | null; afectados: { guardiaId: string }[] }> {
  const r = await apiFetch<{ politica: string | null; afectados: { guardiaId: string }[] }>(`/api/puntos-fijos/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  revalidateTag(TAGS.puntosFijos);
  revalidateTag(TAGS.patrullas);
  revalidateTag(TAGS.ubicaciones);
  return r;
}

/** Cancela UNA ejecución (las otras asignaciones de la misma ruta guardada siguen). */
export async function cancelarEjecucion(ejecucionId: string): Promise<{ ejecucionId: string; cancelados: number }> {
  const result = await apiFetch<{ ejecucionId: string; cancelados: number }>(`/api/mapas/ejecuciones/${encodeURIComponent(ejecucionId)}/cancelar`, { method: 'PATCH' });
  revalidateTag(TAGS.patrullas);
  revalidateTag(TAGS.ubicaciones);
  revalidateTag(TAGS.puntosFijos);
  revalidateTag(TAGS.programacion);
  return result;
}

// --- Programación de rutas (F5) ------------------------------------------------
// Agenda, avisos y estado del planificador cambian solos (el planificador abre,
// asigna y cierra horarios cada minuto): se leen siempre frescos. Con caché, al
// abrir la agenda tras un rato se veía primero la foto vieja (y la campana
// llegaba hasta 30 s tarde). Las mutaciones igual revalidan el tag.
export async function getProgramaciones(): Promise<ProgramacionRow[]> {
  return apiFetch<ProgramacionRow[]>('/api/programaciones', {});
}

export async function getAgendaProgramada(desde?: string, hasta?: string): Promise<HorarioAgenda[]> {
  const qs = new URLSearchParams();
  if (desde) qs.set('desde', desde);
  if (hasta) qs.set('hasta', hasta);
  return apiFetch<HorarioAgenda[]>(`/api/programaciones/agenda${qs.size ? `?${qs}` : ''}`, {});
}

export async function getAvisosProgramacion(): Promise<AvisoProgramacion[]> {
  return apiFetch<AvisoProgramacion[]>('/api/programaciones/pendientes', {});
}

/**
 * El planificador abre, inicia y cierra horarios en el SERVIDOR (sin una
 * acción de la web que invalide la caché). Al llegar su evento en vivo, la
 * web invalida lo que cambió antes de recargar; si no, el mapa mostraba la
 * foto anterior hasta recargar la página.
 * Es una Server Action (este módulo es 'use server') y no pasa por el API:
 * solo una sesión válida puede invalidar la caché.
 */
export async function revalidarHorariosEnVivo(): Promise<void> {
  if (!(await getServerSession())) return;
  revalidateTag(TAGS.patrullas);
  revalidateTag(TAGS.ubicaciones);
  revalidateTag(TAGS.puntosFijos);
  revalidateTag(TAGS.programacion);
}

/** F6: el operador terminó de elegir a mano (o cerró el selector): la automática sigue al momento. */
export async function reanudarAutomatica(ejecucionId: string): Promise<void> {
  await apiFetch(`/api/programaciones/horarios/${encodeURIComponent(ejecucionId)}/reanudar`, { method: 'POST', body: {} });
  revalidateTag(TAGS.programacion);
  revalidateTag(TAGS.patrullas);
}

/** F6: a quién eligió o descartó la asignación automática en un horario (siempre fresco). */
export async function getIntentosAutomaticos(ejecucionId: string): Promise<IntentosAutomaticos> {
  return apiFetch<IntentosAutomaticos>(`/api/programaciones/horarios/${encodeURIComponent(ejecucionId)}/automatica`, {});
}

export async function getPlanificador(): Promise<EstadoPlanificador> {
  return apiFetch<EstadoPlanificador>('/api/programaciones/planificador', {});
}

export async function crearProgramacion(body: ProgramacionBody): Promise<ProgramacionRow> {
  const r = await apiFetch<ProgramacionRow>('/api/programaciones', { method: 'POST', body });
  revalidateTag(TAGS.programacion);
  return r;
}

export async function actualizarProgramacion(id: string, body: ProgramacionBody): Promise<ProgramacionRow> {
  const r = await apiFetch<ProgramacionRow>(`/api/programaciones/${encodeURIComponent(id)}`, { method: 'PATCH', body });
  revalidateTag(TAGS.programacion);
  return r;
}

/** Elimina (lógico) una programación: cancela su horario abierto y libera a sus guardias. */
export async function eliminarProgramacion(id: string): Promise<{ guardiasLiberados: number }> {
  const r = await apiFetch<{ guardiasLiberados: number }>(`/api/programaciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
  revalidateTag(TAGS.programacion);
  revalidateTag(TAGS.patrullas);
  revalidateTag(TAGS.ubicaciones);
  revalidateTag(TAGS.puntosFijos);
  return r;
}

export async function cambiarPlanificador(habilitado: boolean, motivo?: string | null): Promise<EstadoPlanificador> {
  const r = await apiFetch<EstadoPlanificador>('/api/programaciones/planificador', { method: 'PATCH', body: { habilitado, motivo: motivo ?? null } });
  revalidateTag(TAGS.programacion);
  return r;
}

/** Saca una ruta de la biblioteca (borrado lógico); las asignaciones en curso siguen. */
export async function archivarRuta(id: string): Promise<void> {
  await apiFetch(`/api/mapas/rutas/${encodeURIComponent(id)}/archivar`, { method: 'PATCH' });
  revalidateTag(TAGS.rutas);
}

/** Parámetros de una ruta establecida/guardada (aplican a las próximas asignaciones). */
export async function actualizarRuta(
  id: string,
  patch: { nombre?: string; descripcion?: string | null; tipo?: 'establecida' | 'guardada'; modalidad?: PatrullaModalidad | null },
): Promise<void> {
  await apiFetch(`/api/mapas/rutas/${encodeURIComponent(id)}`, { method: 'PATCH', body: patch });
  revalidateTag(TAGS.rutas);
}

/** Atiende exactamente las alertas SOS indicadas (F2); el estado sale del turno real. */
export async function atenderSos(guardiaId: string, alertaIds?: string[]): Promise<{ pendientes: number; estadoOperativo: string }> {
  const result = await apiFetch<{ pendientes: number; estadoOperativo: string }>(`/api/guardias/${encodeURIComponent(guardiaId)}/sos/atender`, {
    method: 'POST',
    body: alertaIds && alertaIds.length > 0 ? { alertaIds } : {},
  });
  revalidateTag(TAGS.ubicaciones);
  revalidateTag(TAGS.guardias);
  revalidateTag(TAGS.dashboardKpi);
  return result;
}

// POST /api/mapas/rutas (RF-G3-09, 2026-09-14) — `trazado` viaja como
// array de puntos [lng, lat] pelado (ver trazadoValido arriba), no como
// GeoJSON — mismo formato que ya lee la app móvil en producción.
export async function crearRutaPlantilla(data: Omit<RutaPlantillaRow, 'id' | 'creadaEn'>): Promise<RutaPlantillaRow> {
  const result = await apiFetch<ApiRuta>('/api/mapas/rutas', {
    method: 'POST',
    body: {
      nombre: data.nombre,
      descripcion: data.descripcion ?? null,
      trazado: data.trazado,
      activo: data.activa,
      modalidad: data.modalidad ?? null,
      tipo: data.tipo === 'establecida' ? 'establecida' : 'guardada',
    },
  });
  revalidateTag(TAGS.rutas);
  return {
    id: result.id,
    nombre: result.nombre,
    descripcion: result.descripcion ?? undefined,
    epiId: epiDeCodigo(result.epiCodigo),
    trazado: trazadoValido(result.trazado) ?? data.trazado,
    activa: result.activo ?? data.activa,
    modalidad: (result.modalidad as RutaPlantillaRow['modalidad']) ?? data.modalidad,
    tipo: (result.tipo as TipoRuta | undefined) ?? data.tipo,
  };
}

// Cancela una ruta compartida (RF-G3-09, 2026-09-14): todos los guardias
// vigentes en esa rutaPlantillaId quedan 'cancelada' de un solo golpe — el
// Operador cancela LA RUTA (el trazado compartido), no a un guardia
// individual. El guardia sigue apareciendo en el Mapa de Patrullaje en Vivo
// (su pin depende solo de telemetría/estadoOperativo, nunca de la ruta) —
// lo que desaparece es la línea de la ruta y su agrupación en el panel.
export async function cancelarRuta(rutaPlantillaId: string): Promise<{ rutaPlantillaId: string; cancelados: number }> {
  const result = await apiFetch<{ rutaPlantillaId: string; cancelados: number }>(`/api/mapas/rutas/${encodeURIComponent(rutaPlantillaId)}/cancelar`, { method: 'PATCH' });
  revalidateTag(TAGS.rutas);
  revalidateTag(TAGS.patrullas);
  revalidateTag(TAGS.ubicaciones);
  return result;
}

// Complemento (2026-09-14): saca a UN guardia de una ruta compartida sin
// tocar a los demás — `patrullaId` es la fila propia de ese guardia dentro
// de la ruta (PatrullaRow.id, no el id de la ruta).
export async function cancelarPatrulla(patrullaId: string, reposicion?: 'automatica' | 'manual'): Promise<{ patrullaId: string; guardiaId: string }> {
  // F6: en un horario automático, `reposicion` decide si se busca reemplazo o pasa a manual.
  const result = await apiFetch<{ patrullaId: string; guardiaId: string }>(`/api/mapas/patrullas/${encodeURIComponent(patrullaId)}/cancelar`, {
    method: 'PATCH',
    body: reposicion ? { reposicion } : {},
  });
  revalidateTag(TAGS.patrullas);
  revalidateTag(TAGS.ubicaciones);
  revalidateTag(TAGS.puntosFijos);
  revalidateTag(TAGS.programacion);
  return result;
}

// Jurisdicción por EPI (2026-10-05): polígonos para la capa "cristal" del
// mapa + la EPI del usuario. Sin caché compartido — `miEpiCodigo` depende
// de quién pregunta.
interface ApiJurisdiccion {
  epis: {
    id: string;
    codigo: string;
    numero: number | null;
    nombre: string;
    color: string | null;
    sede: { lat: number; lng: number; direccion: string | null } | null;
    poligono: EpiJurisdiccion['poligono'];
  }[];
  miEpiCodigo: string | null;
  restringido: boolean;
}

// Ya no descarta EPIs cuyo código "no conoce": todo lo que el backend
// declara operativo se dibuja (antes una EPI nueva desaparecía del mapa).
export async function getJurisdiccion(): Promise<Jurisdiccion> {
  const data = await apiFetch<ApiJurisdiccion>('/api/mapas/jurisdiccion');
  return {
    epis: data.epis.map((e) => ({
      zone: e.codigo,
      numero: e.numero,
      nombre: e.nombre,
      color: e.color,
      sede: e.sede,
      poligono: e.poligono,
    })),
    miEpi: data.miEpiCodigo,
    restringido: data.restringido,
  };
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
  epiCodigo: string | null;
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
    epi: row.epiCodigo ?? undefined,
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
  revalidateTag(TAGS.guardias);
  return row ? rowToGuardApi(row) : null;
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
  // Resolver un SOS (o cualquier cambio de estado operativo) toca guardias,
  // ubicaciones (esSos/estadoOperativo en el mapa) y el KPI del Dashboard —
  // sin esto el Operador veía la alerta seguir "pendiente" hasta que el
  // TTL del cache expirara solo (bug reportado: la tarjeta/aviso tardaba
  // en desaparecer al marcar como resuelto).
  revalidateTag(TAGS.guardias);
  revalidateTag(TAGS.ubicaciones);
  revalidateTag(TAGS.dashboardKpi);
  return row ? rowToGuardApi(row) : null;
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
      ...(patch.epiId !== undefined ? { epiCodigo: patch.epiId || null } : {}),
    },
  });
  revalidateTag(TAGS.guardias);
  return row ? rowToGuardApi(row) : null;
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
  epi?: EpiZone | null;
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
      epiCodigo: data.epi || null,
    },
  });
  revalidateTag(TAGS.guardias);
  return { guardia: rowToGuardApi(result.guardia), usuario: result.usuario, passwordTemporal: result.passwordTemporal };
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
  epi: EpiZone;
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
      epiCodigo: data.epi || null,
    },
  });
  return { usuario: rowToUserApi(result.user), passwordTemporal: result.temporaryPassword };
}

// ---------------------------------------------------------------------------
// DASHBOARD — KPIs y series agregadas, conectado a /api/dashboard.
// ---------------------------------------------------------------------------

function dayShort(dia: string): string {
  // dia es YYYY-MM-DD ya en America/La_Paz (backend genera via AT TIME ZONE).
  // Crear como mediodía -04:00 evita salto por UTC.
  const d = new Date(`${dia}T12:00:00-04:00`);
  if (Number.isNaN(d.getTime())) return dia;
  const label = d.toLocaleDateString('es-BO', { weekday: 'short', timeZone: 'America/La_Paz' });
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
  return apiFetch('/api/dashboard/kpi', { revalidate: 10, tags: [TAGS.dashboardKpi] });
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
  const rows = await apiFetch<{ zona: string | null; epiCodigo: string | null; total: number }[]>('/api/dashboard/series/por-zona', { revalidate: 30 });
  const pct = withPercentage(rows.map((r) => ({ label: r.zona ?? 'Sin EPI', total: r.total })));
  return rows.map((r, i) => ({ zone: r.epiCodigo, nombre: r.zona ?? 'Sin EPI', total: r.total, percentage: pct[i]!.percentage }));
});

export interface AppNotification {
  id: string;
  title: string;
  timestamp: string;
  read?: boolean;
  guardiaId?: string;
  hechoId?: string;
  /** F5: horario programado al que le faltan guardias. */
  ejecucionId?: string;
  kind: 'sos' | 'bateria' | 'hecho' | 'ruta' | 'programada';
}

export interface Mandado {
  id: string;
  guardiaId: string;
  guardiaNombre?: string | null;
  descripcion: string;
  lat: number;
  lng: number;
  creadoEn: string;
}

interface ApiMandado {
  id: string;
  guardiaId: string;
  guardiaNombre?: string | null;
  descripcion: string;
  lat: number;
  lng: number;
  creadoEn: string;
}

export const getMandados = cache(async (limit = 50): Promise<Mandado[]> => {
  try {
    const rows = await apiFetch<ApiMandado[]>(`/api/mandados/todos?limit=${limit}`, { revalidate: 5 });
    return rows.map((r) => ({
      id: r.id,
      guardiaId: r.guardiaId,
      guardiaNombre: r.guardiaNombre ?? null,
      descripcion: r.descripcion,
      lat: r.lat,
      lng: r.lng,
      creadoEn: r.creadoEn,
    }));
  } catch {
    return [];
  }
});

export const getNotificaciones = cache(async (limit = 10): Promise<AppNotification[]> => {
  try {
    const [ubicaciones, hechos, mandados, patrullas, programadas] = await Promise.all([
      apiFetch<ApiUbicacionGuardia[]>('/api/mapas/ubicaciones', { revalidate: 10, tags: [TAGS.ubicaciones] }).catch(() => [] as ApiUbicacionGuardia[]),
      apiFetch<ApiHecho[]>('/api/hechos', { revalidate: 15, tags: [TAGS.hechos] }).catch(() => [] as ApiHecho[]),
      getMandados(3).catch(() => [] as Mandado[]),
      getPatrullas().catch(() => [] as PatrullaRow[]),
      // F5: sin el permiso (o con el backend caído) simplemente no hay avisos de horarios.
      getAvisosProgramacion().catch(() => [] as AvisoProgramacion[]),
    ]);
    // Cada entrada guarda su fecha real (`_ts`) además del `timestamp` ya
    // formateado para mostrar — antes la lista se armaba concatenando por
    // categoría (SOS, luego hechos, luego batería, GPS, mandados, fuera de
    // ruta) sin mirar la fecha en absoluto, así que un SOS de hace horas
    // podía aparecer arriba de un hecho reportado hace un minuto. Se
    // ordena todo por `_ts` desc recién al final, antes de recortar al
    // límite, y se descarta `_ts` del resultado (no es parte de
    // AppNotification).
    const conFecha: (AppNotification & { _ts: number })[] = [];

    const sos = ubicaciones.filter((u) => u.sosAbierto).slice(0, 5);
    for (const u of sos) {
      conFecha.push({
        id: `sos-${u.guardiaId}`,
        title: `SOS — ${u.guardiaNombre} (${u.epiCodigo ?? '—'})`,
        timestamp: formatRelative(u.capturadoEn),
        read: false,
        guardiaId: u.guardiaId,
        kind: 'sos' as const,
        _ts: new Date(u.capturadoEn).getTime(),
      });
    }
    const hechosRecientes = hechos.filter((h) => h.estado === 'reportado' || h.estado === 'en_revision').slice(0, 5);
    for (const h of hechosRecientes) {
      conFecha.push({
        id: h.id,
        title: `${h.tipoLabel}: ${h.descripcion.slice(0, 50)}`,
        timestamp: toDDMMAAAAHHMM(h.ocurridoEn),
        read: false,
        hechoId: h.id,
        guardiaId: h.guardiaId,
        kind: 'hecho' as const,
        _ts: new Date(h.ocurridoEn).getTime(),
      });
    }
    const bateriaBaja = ubicaciones.filter((u) => (u.bateriaPct ?? 100) < 20).slice(0, 3);
    for (const b of bateriaBaja) {
      conFecha.push({ id: `bat-${b.guardiaId}`, title: `Batería baja — ${b.guardiaNombre} (${b.bateriaPct}%)`, timestamp: formatRelative(b.capturadoEn), read: false, guardiaId: b.guardiaId, kind: 'bateria' as const, _ts: new Date(b.capturadoEn).getTime() });
    }
    // Alerta GPS desactualizado (más de 10 min sin actualización)
    const gpsStale = ubicaciones.filter((u) => {
      const edad = Math.round((Date.now() - new Date(u.capturadoEn).getTime()) / 60000);
      return edad > 10;
    }).slice(0, 3);
    for (const g of gpsStale) {
      conFecha.push({ id: `gps-${g.guardiaId}`, title: `GPS sin actualizar — ${g.guardiaNombre} (${Math.round((Date.now() - new Date(g.capturadoEn).getTime()) / 60000)}min)`, timestamp: formatRelative(g.capturadoEn), read: false, guardiaId: g.guardiaId, kind: 'bateria' as const, _ts: new Date(g.capturadoEn).getTime() });
    }
    for (const m of mandados.slice(0, 3)) {
      conFecha.push({ id: `mandado-${m.id}`, title: `Tarea — ${m.descripcion.slice(0, 45)}`, timestamp: formatRelative(m.creadoEn), read: false, guardiaId: m.guardiaId, kind: 'hecho' as const, _ts: new Date(m.creadoEn).getTime() });
    }
    // Guardia fuera de ruta (F2): el estado lo calcula el servidor en cada
    // ping, con umbrales por modalidad. La campana solo avisa las alertas
    // ROJAS; las advertencias quedan en el panel lateral del mapa.
    const ubicacionPor = new Map(ubicaciones.map((u) => [u.guardiaId, u]));
    for (const p of patrullas) {
      if (p.estadoRuta !== 'alerta') continue;
      const u = ubicacionPor.get(p.guardiaId);
      if (!u) continue;
      conFecha.push({
        id: `ruta-${p.guardiaId}`,
        title: `Fuera de ruta — ${u.guardiaNombre} a ${p.distanciaRutaM ?? '?'} m de su ruta`,
        timestamp: formatRelative(u.capturadoEn),
        read: false,
        guardiaId: p.guardiaId,
        kind: 'ruta' as const,
        _ts: new Date(u.capturadoEn).getTime(),
      });
    }
    // Horarios programados con guardias por asignar (F5). Se leen de la BD:
    // aparecen aunque el socket esté caído. El id incluye cuántos faltan, así
    // un cambio en la cobertura vuelve a marcarse como no leído.
    for (const a of programadas.slice(0, 5)) {
      const hora = new Date(a.inicio).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz' });
      // F6: en un horario automático el sistema sigue buscando solo (el radio crece si no encuentra).
      const falta = a.faltan === 1 ? 'falta 1 guardia' : `faltan ${a.faltan} guardias`;
      const radio = a.radioM ? `${(a.radioM / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} km` : null;
      conFecha.push({
        id: `prog-${a.ejecucionId}-${a.faltan}${a.automatica ? `-${a.radioM ?? ''}` : ''}`,
        title: a.automatica
          ? `Ruta automática «${a.nombre}» ${hora}: ${falta}; buscando${radio ? ` en ${radio}` : ''}`
          : `Ruta programada «${a.nombre}» ${hora}: ${a.faltan === 1 ? 'falta asignar 1 guardia' : `faltan asignar ${a.faltan} guardias`}`,
        timestamp: a.empezado ? 'En curso' : `Empieza a las ${hora}`,
        read: false,
        ejecucionId: a.ejecucionId,
        kind: 'programada' as const,
        // Pendientes de trabajo: arriba de la lista mientras sigan abiertos.
        _ts: Date.now(),
      });
    }
    return conFecha
      .sort((a, b) => b._ts - a._ts)
      .slice(0, limit)
      .map(({ _ts, ...n }) => n);
  } catch {
    return [];
  }
});
