// Tipos "fila" alineados exactamente con `patrulla` y `ruta_plantilla` de
// BD/02_tables.sql (RF-G3-09, MASTER.md sección 14.4). Tipo compartido:
// lo usan mapas y guardias (2+ módulos) — MASTER.md sección 6.

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

// Punto individual — el lugar estratégico que le toca a UN guardia dentro
// de una ruta compartida por varios (ver GeoJsonLineString). Reemplaza el
// polígono chico que antes se fabricaba alrededor de cada guardia
// (RF-G3-09 rediseño 2026-09-14): ya no tiene sentido simular un "área de
// cobertura" — el punto es literalmente dónde debe incorporarse.
export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat]
}

// El trazado de una ruta — 2 a 5 puntos que el Operador marca en el mapa,
// en el orden en que deben recorrerse (BD real: `ruta_plantilla.trazado`,
// columna jsonb — confirmado por consulta directa a Supabase 2026-09-14,
// ver informe "Mapa — Rediseño de Rutas" para el equipo de Backend/Móvil).
// NO es un objeto GeoJSON envuelto (`{type, coordinates}`) — es el array de
// puntos [lng, lat] pelado. Se eligió ese formato (y no el wrapper GeoJSON
// que se usó en un primer borrador) porque la app móvil YA ESTABA en
// producción leyendo `ruta_plantilla.trazado` como `[number, number][]`
// directo (`appmunicipal/src/api/patrullas.ts:trazadoAZona`) — cambiar la
// forma habría roto esa lectura ya existente sin que el equipo de Móvil
// tuviera forma de anticiparlo.
export type TrazadoPuntos = [number, number][];

export const PATRULLA_ESTADOS = ['asignada', 'en_curso', 'completada', 'cancelada'] as const;
export type PatrullaEstado = (typeof PATRULLA_ESTADOS)[number];

// Modalidad de patrullaje — no existe como columna en la tabla `patrulla`
// real (BD/02_tables.sql), es una extensión del mock igual que otras ya
// documentadas en este proyecto (ver types/user.ts). Se basa en el rol de
// servicio real de la Dirección (design/infoRutas/ROL DE SERVICIO...md):
// grupos móviles se reparten en coches (hasta 4) y motos (hasta 2), los
// puntos con nombre (Cristo Seguro, Coronilla, Plaza Principal...) forman
// directo en el sitio con 1-2 guardias — a veces divididos en sub-puntos
// del mismo lugar —, y hay guardias a pie y de oficina.
export const PATRULLA_MODALIDADES = ['coche', 'moto', 'a_pie', 'punto_fijo', 'oficina'] as const;
export type PatrullaModalidad = (typeof PATRULLA_MODALIDADES)[number];

export const PATRULLA_MODALIDAD_LABELS: Record<PatrullaModalidad, string> = {
  coche: 'Coche / Vehículo',
  moto: 'Motocicleta',
  a_pie: 'A Pie',
  punto_fijo: 'Punto de Servicio Fijo',
  oficina: 'Oficina',
};

// Capacidad máxima de guardias por unidad, según el rol de servicio real.
export const PATRULLA_MODALIDAD_CAPACIDAD: Record<PatrullaModalidad, number> = {
  coche: 4,
  moto: 2,
  a_pie: 3,
  punto_fijo: 2,
  oficina: 8,
};

// poligonoGeojson es siempre una copia editable, independiente de la
// plantilla origen (rutaPlantillaId es la referencia real que agrupa a
// todos los guardias de una misma asignación — ver rediseño 2026-09-14 en
// assignRoute.ts) — BD/02_tables.sql comentario en patrulla.ruta_plantilla_id.
// Desde el rediseño, este campo guarda el PUNTO individual (GeoJsonPoint)
// que le tocó a este guardia dentro de la ruta compartida — el nombre de
// columna real (`poligono_geojson`) quedó de la época de "área de
// cobertura" pero el jsonb acepta cualquier geometría.
//
// unidadId (extensión del mock, no existe en la tabla real): agrupa las
// filas de guardias que viajan juntos en la misma unidad física (ej. los
// 4 ocupantes de un coche) o que cubren puntos distintos del mismo
// servicio con nombre (ej. sub-puntos de un mismo sitio) — la tabla real
// sigue siendo 1 fila por guardia, esto solo permite dibujarlos
// relacionados en el mapa (Caso B/C de la bandeja de Patrullaje).
export interface PatrullaRow {
  id: string;
  guardiaId: string;
  operadorId: string;
  epiId: string;
  rutaPlantillaId?: string;
  /** Nombre/trazado de la ruta_plantilla compartida — embebido por el backend en cada fila, ver rowToPatrullaApi. */
  rutaNombre?: string;
  trazado?: TrazadoPuntos;
  nombre: string;
  descripcion?: string;
  poligonoGeojson: GeoJsonPolygon | GeoJsonPoint;
  estado: PatrullaEstado;
  modalidad: PatrullaModalidad;
  unidadId?: string;
  horaInicioProgramada?: string;
  horaFinProgramada?: string;
  horaInicioReal?: string;
  horaFinReal?: string;
}

// Biblioteca de rutas reutilizables. `trazado`: 2 a 5 puntos, en orden, que
// definen el camino que deben seguir los guardias — es la fuente de verdad
// única compartida por Web y Móvil (mismo backend, ver informe "Mapa —
// Rediseño de Rutas"). `activa` ahora solo controla si aparece en "Usar
// Plantilla Guardada" para asignaciones futuras — toda asignación nueva de
// 2+ guardias crea una fila `ruta_plantilla` igual, se guarde o no como
// reutilizable (necesario para que los guardias compartan la misma ruta).
export interface RutaPlantillaRow {
  id: string;
  nombre: string;
  descripcion?: string;
  epiId: string;
  trazado: TrazadoPuntos;
  activa: boolean;
}
