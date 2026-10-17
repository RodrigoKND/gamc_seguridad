import { pathLengthMeters, pointAtDistance, type LatLng } from './routeGeometry';

// "Calles por donde pasará" una ruta, en lenguaje natural (geocodificación
// inversa sobre 4 puntos del trazado). Los MISMOS 4 puntos se marcan en el
// mapa con un rombo (RouteLinesLayer): cada rombo = una calle de la lista.
// Se reparten por DISTANCIA recorrida (no por índice de vértice, que se
// amontonaba donde el trazado tiene muchas curvas): ruta abierta → inicio,
// 1/3, 2/3 y fin; circuito cerrado (inicio = fin) → inicio, 1/4, 1/2 y 3/4,
// para que sean 4 lugares distintos. Primero
// Nominatim; si no responde (servidor público que limita o bloquea por
// exceso de uso — pasó el 16/10), Photon, otro geocodificador gratuito sobre
// los mismos datos de OpenStreetMap.
//
// Caché (pedido del usuario 16/10: "cada que salgo y entro aparece
// 'Resolviendo calles'"): el resultado YA TRADUCIDO se guarda por trazado
//  · en memoria (instantáneo dentro de la misma pestaña) y
//  · en el navegador (localStorage), para que sobreviva a recargar la página.
// La clave son las coordenadas muestreadas (no la referencia del arreglo,
// que cambia con cada ping de GPS y antes volvía a disparar la consulta).
// Solo se guardan resultados completos: si alguna calle no se pudo resolver
// (Nominatim caído o limitando), se muestra lo que haya y se reintenta la
// próxima vez. Es una caché de comodidad: si el navegador no deja guardar,
// simplemente se vuelve a consultar.

// v2: una entrada por muestra (sin unir repetidas) y muestras por distancia.
const CLAVE = 'gamc_calles_ruta_v2';
/** Inicio y fin a menos de esto = circuito cerrado. */
const CIERRE_M = 40;
const MAX_ENTRADAS = 200;

const memoria = new Map<string, string[]>();
const enCurso = new Map<string, Promise<{ calles: string[]; completo: boolean }>>();
let cargado = false;

function cargar() {
  if (cargado) return;
  cargado = true;
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE) ?? '[]') as [string, string[]][];
    if (Array.isArray(datos)) for (const [k, v] of datos) if (typeof k === 'string' && Array.isArray(v)) memoria.set(k, v);
  } catch {
    /* sin almacenamiento o dato corrupto: se empieza vacío */
  }
}

function persistir() {
  try {
    // Las más nuevas al final; se descartan las más viejas.
    const entradas = Array.from(memoria.entries()).slice(-MAX_ENTRADAS);
    localStorage.setItem(CLAVE, JSON.stringify(entradas));
  } catch {
    /* ignorar: solo es comodidad */
  }
}

export interface MuestraRuta {
  punto: LatLng;
  /** "Inicio de la ruta", "Pasa por", "Fin de la ruta" o "Inicio y fin de la ruta". */
  etiqueta: string;
}

/** Los 4 puntos de la ruta que se traducen a calles y se marcan con rombo. */
export function muestrasDe(path: LatLng[]): MuestraRuta[] {
  if (path.length < 2) return [];
  const total = pathLengthMeters(path);
  if (total <= 0) return [];
  const cerrada = pathLengthMeters([path[0]!, path[path.length - 1]!]) < CIERRE_M;
  const fracciones = cerrada ? [0, 1 / 4, 1 / 2, 3 / 4] : [0, 1 / 3, 2 / 3, 1];
  return fracciones.map((f, i) => ({
    punto: pointAtDistance(path, f * total),
    etiqueta: i === 0 ? (cerrada ? 'Inicio y fin de la ruta' : 'Inicio de la ruta') : !cerrada && i === fracciones.length - 1 ? 'Fin de la ruta' : 'Pasa por',
  }));
}

export function claveCalles(muestras: LatLng[]): string {
  return muestras.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join('|');
}

/** Resultado ya guardado (memoria o navegador), sin consultar. */
export function callesGuardadas(clave: string): string[] | null {
  cargar();
  return memoria.get(clave) ?? null;
}

async function nombreDe(p: LatLng): Promise<string | null> {
  return (await nombreNominatim(p)) ?? (await nombrePhoton(p));
}

async function nombrePhoton(p: LatLng): Promise<string | null> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${p.lat}&lon=${p.lng}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: { properties?: Record<string, string | undefined> }[] };
    const pr = data.features?.[0]?.properties;
    if (!pr) return null;
    const via = pr.street || (pr.type === 'street' ? pr.name : undefined) || pr.name || pr.locality || pr.district;
    if (!via) return null;
    return pr.city ? `${via}, ${pr.city}` : via;
  } catch {
    return null;
  }
}

async function nombreNominatim(p: LatLng): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.lat}&lon=${p.lng}&zoom=16&addressdetails=1`, {
      headers: { 'Accept-Language': 'es' },
      // Si no contesta pronto se pasa a Photon (no dejar "Resolviendo…" colgado).
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address ?? {};
    const road = addr.road || addr.pedestrian || addr.footway || addr.neighbourhood || addr.suburb || '';
    const city = addr.city || addr.town || addr.village || '';
    if (road) return city ? `${road}, ${city}` : road;
    return data.display_name?.split(',').slice(0, 2).join(',').trim() || null;
  } catch {
    return null;
  }
}

/** Resuelve (o devuelve de la caché) las calles del trazado, ya en texto. */
export function resolverCalles(muestras: LatLng[]): Promise<{ calles: string[]; completo: boolean }> {
  const clave = claveCalles(muestras);
  const guardadas = callesGuardadas(clave);
  if (guardadas) return Promise.resolve({ calles: guardadas, completo: true });
  const pendiente = enCurso.get(clave);
  if (pendiente) return pendiente;
  const promesa = Promise.all(muestras.map(nombreDe)).then((nombres) => {
    const completo = nombres.every((n) => n !== null);
    // Una entrada por muestra (no se unen repetidas): cada una tiene su rombo en el mapa.
    const calles = nombres.map((n, i) => n ?? `${muestras[i]!.lat.toFixed(4)}, ${muestras[i]!.lng.toFixed(4)}`);
    if (completo) {
      memoria.delete(clave);
      memoria.set(clave, calles);
      persistir();
    }
    return { calles, completo };
  });
  enCurso.set(clave, promesa);
  void promesa.finally(() => enCurso.delete(clave));
  return promesa;
}
