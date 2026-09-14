// Punto único de acceso a variables de entorno / configuración de APIs
// externas — MASTER.md sección 6 ("lib/ — conectores e integraciones
// externas... nunca embebidos dentro de un componente").
//
// Los valores en sí viven en .env.local (no commiteado — ver .gitignore) y
// están documentados en .env.example. Los conectores reales (db.ts,
// auth.ts, websocket.ts, api-client.ts) importan sus valores desde aquí en
// vez de leer process.env directamente, para que exista un solo lugar
// donde agregar/renombrar una llave.
//
// Todas las variables de mapConfig son NEXT_PUBLIC_* (se envían al bundle
// del cliente) porque MapCanvas.tsx corre en el navegador. No poner aquí
// ningún secreto que no deba ser público.

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const mapConfig = {
  tileUrl: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; OpenStreetMap contributors',
  tileApiKey: process.env.NEXT_PUBLIC_MAP_TILE_API_KEY || undefined,
  defaultCenter: {
    lat: readNumber(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT, -17.3935),
    lng: readNumber(process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG, -66.1653),
  },
  defaultZoom: readNumber(process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM, 13),
} as const;

// Placeholders para cuando Dev B conecte api-client.ts / websocket.ts —
// no lanzan error si faltan, para no romper el build antes de tiempo.
export const apiConfig = {
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || '',
  websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || '',
} as const;

// Solo uso de servidor (sin NEXT_PUBLIC_) — para db.ts / auth.ts (Dev B).
export const serverConfig = {
  databaseUrl: process.env.DATABASE_URL || '',
  // Debe coincidir con JWT_SECRET del API (gamc-api/.env): firma/verificación
  // de los JWT de acceso en middleware.y rutas de servidor.
  authSecret: process.env.JWT_SECRET || process.env.AUTH_SECRET || '',
} as const;
