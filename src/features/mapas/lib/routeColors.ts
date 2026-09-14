// Colores para diferenciar rutas activas en el mapa y en el panel derecho
// (RF-G3-09, rediseño 2026-09-14: "deben cambiar de color las rutas... para
// diferenciarlas"). Evita el rojo (reservado para SOS, ver PatrolLayer) y
// el dorado de marca (reservado para selección/acento, ver Modal
// accent="gold") para que una línea de ruta nunca se confunda con esas dos
// señales ya establecidas en el mapa.
export const ROUTE_COLOR_PALETTE = [
  '#2563EB', // azul
  '#7C3AED', // violeta
  '#059669', // verde esmeralda
  '#EA580C', // naranja
  '#DB2777', // rosa
  '#0891B2', // cian
  '#65A30D', // verde lima
  '#9333EA', // púrpura
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
