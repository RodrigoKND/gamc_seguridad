// Normalización de texto para búsqueda tolerante a tildes/mayúsculas —
// compartido por los filtros de búsqueda de Guardias, Catálogo de Guardias
// y Hechos/Reportes (los 3 roles). "México" debe encontrar "mexico" y
// viceversa.
//
// Construido con String.fromCharCode (en vez de un literal ̀-ͯ en
// el código fuente) para no depender de cómo el editor/terminal represente
// esos caracteres combinantes al guardar el archivo.
const DIACRITICS_PATTERN = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  'g',
);

export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(DIACRITICS_PATTERN, '').toLowerCase();
}
