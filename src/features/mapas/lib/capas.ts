import type { DivIcon } from 'leaflet';

// Jerarquía de capas del mapa en vivo y su visibilidad por zoom (pedido del
// usuario 16/10: "orden jerárquico coherente… lista de prioridades para el
// orden de visibilidad"). Un solo lugar para que ninguna capa invente su
// propio z-index.
//
// Criterio (convención de cartografía operativa — despacho, flotas):
//   1. lo que exige ACCIÓN inmediata va arriba de todo (SOS, guardia elegido);
//   2. después lo que se MUEVE (guardias en vivo);
//   3. después los lugares de servicio con estado (puntos fijos n/cap);
//   4. después referencias institucionales fijas (sedes, módulos);
//   5. después las líneas (checkpoints, rutas, trayectos de incorporación);
//   6. al fondo el territorio (EPI, referencia Centro).
// Leaflet ya usa: tilePane 200, overlayPane 400, shadowPane 500,
// markerPane 600, tooltipPane 650, popupPane 700. Las capas propias se
// intercalan con esos valores; tooltips y popups siempre quedan encima.

export const PANES = {
  territorios: { name: 'epi-territorios', zIndex: 395 },
  centro: { name: 'epi-centro', zIndex: 396 },
  // overlayPane (400): zonas del mapa de calor.
  trayectos: { name: 'trayectos', zIndex: 410 },
  rutas: { name: 'rutas', zIndex: 420 },
  checkpoints: { name: 'checkpoints', zIndex: 440 },
  modulos: { name: 'epi-modulos', zIndex: 450 },
  sedes: { name: 'epi-sedes', zIndex: 460 },
  puntos: { name: 'puntos-fijos', zIndex: 480 },
  // markerPane (600): guardias y sus clusters.
  prioritarios: { name: 'guardias-prioritarios', zIndex: 640 },
} as const;

// Visibilidad por nivel de zoom. 11 = área metropolitana (vista inicial del
// Admin y Super Admin), 13 = una EPI (vista inicial del Operador), 15 =
// barrio, 17 = calle. Por debajo de cada umbral la capa se oculta (o se
// resume) para no saturar: en la vista de ciudad solo se ve lo esencial.
// Revisado 16/10 (pedido del usuario): puntos fijos, sedes y módulos se
// encimaban con los guardias en la vista de ciudad. Ahora los símbolos fijos
// aparecen recién al acercarse, primero en tamaño chico y luego completos;
// los guardias (lo que se mueve) siguen visibles en todos los niveles.
export const ZOOM = {
  /** Sedes EPI: chicas desde 13, tamaño completo desde 15. */
  sedes: 13,
  sedesCompletas: 15,
  /** Puntos fijos: pin chico desde 13; pin completo con contador n/cap desde 15. */
  puntos: 13,
  puntosContador: 15,
  /** Subpuntos como pines propios; antes se resumen en su punto (evita pines encimados). */
  subpuntos: 16,
  /** Módulos policiales (si están activados): son muchos, solo a nivel de barrio. */
  modulos: 15,
  /** Punto de incorporación (rombo) de cada guardia sobre su ruta. */
  checkpoints: 15,
  /** Trayectos de incorporación (camino más rápido hasta la ruta). */
  trayectos: 13,
  /** Etiqueta "Centro" de la zona de referencia. */
  etiquetaCentro: 13,
} as const;

/**
 * Línea de incorporación (camino del guardia hasta su ruta o punto): SIEMPRE
 * roja y discontinua (pedido del usuario 16/10), para no confundirla con una
 * ruta — las rutas son líneas continuas y su paleta evita el rojo
 * (routeColors.ts).
 */
export const ESTILO_INCORPORACION = { color: '#DC2626', weight: 3.5, opacity: 0.9, dashArray: '8 7', lineCap: 'round' } as const;

/** Zoom máximo del mapa (las teselas de OpenStreetMap llegan hasta 18). */
export const ZOOM_MAXIMO = 18;

/** Radio de agrupación (px) según zoom: amplio en la ciudad, mínimo a nivel de calle. */
export function radioCluster(zoom: number): number {
  if (zoom <= 12) return 60;
  if (zoom <= 14) return 45;
  if (zoom <= 16) return 30;
  return 18;
}

/** Grosor de las rutas según zoom (más finas de lejos para no tapar el territorio). */
export function grosorRuta(zoom: number): number {
  if (zoom <= 12) return 3;
  if (zoom <= 15) return 4;
  return 5;
}

// Íconos reutilizados mientras no cambie lo que muestran. react-leaflet
// reemplaza el elemento del marcador cada vez que recibe un ícono NUEVO
// (aunque sea igual): eso repetía la animación de aparición (globals.css) en
// cada refresco de datos. Con la misma instancia, el elemento se conserva y
// la animación solo corre cuando el símbolo aparece o cambia de verdad.
const iconos = new Map<string, DivIcon>();
const MAX_ICONOS = 500;

export function iconoCacheado(clave: string, crear: () => DivIcon): DivIcon {
  let icono = iconos.get(clave);
  if (!icono) {
    if (iconos.size >= MAX_ICONOS) iconos.clear();
    icono = crear();
    iconos.set(clave, icono);
  }
  return icono;
}
