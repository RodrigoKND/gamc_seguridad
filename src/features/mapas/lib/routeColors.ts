// Colores para diferenciar rutas activas en el mapa y en el panel derecho
// (RF-G3-09, rediseño 2026-09-14: "deben cambiar de color las rutas... para
// diferenciarlas"). Evita el rojo (reservado para SOS, ver PatrolLayer) y
// los tonos de marca — púrpura y rosa-vino (marcadores de guardia y
// selección/acento, ver MASTER.md sección 4) — para que una línea de ruta
// nunca se confunda con esas señales ya establecidas en el mapa.
export const ROUTE_COLOR_PALETTE = [
  '#2563EB', // azul
  '#059669', // verde esmeralda
  '#EA580C', // naranja
  '#0891B2', // cian
  '#65A30D', // verde lima
  '#475569', // pizarra
] as const;

// Hash estable por id — el color de una ruta no cambia entre recargas ni
// depende del orden en que llegó la respuesta del API (no hay columna de
// color en `ruta_plantilla` todavía, ver informe para Backend).
export function colorForRuta(rutaId: string): string {
  let hash = 0;
  for (let i = 0; i < rutaId.length; i += 1) {
    hash = (hash * 31 + rutaId.charCodeAt(i)) >>> 0;
  }
  return ROUTE_COLOR_PALETTE[hash % ROUTE_COLOR_PALETTE.length];
}
