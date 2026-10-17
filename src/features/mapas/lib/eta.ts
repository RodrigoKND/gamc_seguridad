import type { PatrullaModalidad } from '@/types/patrulla';
import type { PerfilTrayecto } from './routing';
import type { LatLng } from './routeGeometry';

// Tiempo estimado de llegada (ETA) de un guardia que se INCORPORA a su ruta
// o a su punto fijo: cuánto falta para que pase de «incorporándose» a «en
// ruta» (pedido del usuario 16/10, "como hace Google").
//
// Cómo suele hacerse (investigado 16/10):
//  · Google (Routes / Distance Matrix) parte del camino por calles para el
//    medio de transporte y lo ajusta con tráfico histórico + en vivo; además
//    da tres modelos: probable (best_guess), pesimista y optimista.
//  · OSRM (el ruteo que ya usamos, gratis) da la duración a FLUJO LIBRE, sin
//    tráfico; lo habitual es aplicarle un factor según la hora y el día.
//  · El perfil a pie de OSRM es el menos confiable, así que el tiempo a pie
//    se calcula con la distancia por calles y una velocidad fija.
// No hay datos de tráfico en vivo de Cochabamba gratuitos, así que el modelo
// es: duración por calles × factor de la franja horaria + tiempo de arranque,
// en dos valores: PROBABLE y PESIMISTA («tráfico atrancado»). Los factores
// son una propuesta inicial, ajustable con lo que se observe en campo.

export type ModoViaje = 'coche' | 'moto' | 'a_pie';
export type Franja = 'pico' | 'diurna' | 'nocturna';

/** Punto fijo / oficina: se asume que va a pie hasta esta distancia (m); más lejos, en vehículo. */
export const DISTANCIA_MAX_A_PIE_M = 1500;
/** Velocidad a pie con equipo (m/s ≈ 4,5 km/h). */
export const VELOCIDAD_A_PIE_MS = 1.25;
/** Sin ruteo por calles: distancia recta × este factor (calles urbanas no son rectas). */
export const FACTOR_SINUOSIDAD = 1.35;
/** Velocidad a flujo libre si el ruteo no respondió (m/s ≈ 30 km/h). */
export const VELOCIDAD_VEHICULO_MS = 8.3;

/** Multiplicadores sobre la duración a flujo libre, por medio y franja. */
export const FACTORES: Record<ModoViaje, Record<Franja, { probable: number; pesimista: number }>> = {
  coche: { pico: { probable: 1.6, pesimista: 2.3 }, diurna: { probable: 1.25, pesimista: 1.6 }, nocturna: { probable: 1.05, pesimista: 1.25 } },
  // La moto se filtra en el tráfico: le afecta menos el atasco.
  moto: { pico: { probable: 1.25, pesimista: 1.6 }, diurna: { probable: 1.1, pesimista: 1.35 }, nocturna: { probable: 1.0, pesimista: 1.15 } },
  // A pie el tráfico casi no cuenta; el margen es por semáforos y cruces.
  a_pie: { pico: { probable: 1.0, pesimista: 1.2 }, diurna: { probable: 1.0, pesimista: 1.2 }, nocturna: { probable: 1.0, pesimista: 1.15 } },
};

/** Tiempo de arranque (s): subir al vehículo, estacionar al llegar. */
export const ARRANQUE_S: Record<ModoViaje, number> = { coche: 60, moto: 30, a_pie: 0 };

/**
 * Horas pico de Cochabamba (entrada al trabajo y colegios, mediodía y
 * salida), hora de Bolivia. Sábado solo el mediodía.
 */
export function franjaHoraria(fecha: Date): Franja {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/La_Paz', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(fecha);
  const dia = partes.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0);
  const t = h * 60 + m;
  const entre = (a: number, b: number) => t >= a && t < b;
  const laborable = !['Sat', 'Sun'].includes(dia);
  if (laborable && (entre(7 * 60, 9 * 60) || entre(12 * 60, 14 * 60 + 30) || entre(17 * 60 + 30, 19 * 60 + 30))) return 'pico';
  if (dia === 'Sat' && entre(11 * 60 + 30, 13 * 60 + 30)) return 'pico';
  if (entre(6 * 60, 21 * 60)) return 'diurna';
  return 'nocturna';
}

/** Cómo viaja el guardia hasta su ruta según la modalidad de la asignación. */
export function modoDeViaje(modalidad: PatrullaModalidad | null | undefined, distanciaRectaM: number): ModoViaje {
  if (modalidad === 'coche' || modalidad === 'moto' || modalidad === 'a_pie') return modalidad;
  return distanciaRectaM <= DISTANCIA_MAX_A_PIE_M ? 'a_pie' : 'coche';
}

export function perfilDe(modo: ModoViaje): PerfilTrayecto {
  return modo === 'a_pie' ? 'a_pie' : 'vehiculo';
}

export const MODO_ETIQUETA: Record<ModoViaje, string> = { coche: 'en vehículo', moto: 'en moto', a_pie: 'a pie' };
export const FRANJA_ETIQUETA: Record<Franja, string> = { pico: 'hora pico', diurna: 'tráfico normal', nocturna: 'tráfico bajo' };

export interface Eta {
  probableS: number;
  pesimistaS: number;
  franja: Franja;
}

/**
 * ETA a partir del trayecto por calles. `duracionLibreS` = 0 si el ruteo no
 * respondió: se estima con la distancia recta y la sinuosidad.
 */
export function calcularEta(p: { modo: ModoViaje; distanciaM: number; duracionLibreS: number; siguioCalles: boolean; distanciaRectaM: number; fecha: Date }): Eta {
  const franja = franjaHoraria(p.fecha);
  const distancia = p.siguioCalles && p.distanciaM > 0 ? p.distanciaM : p.distanciaRectaM * FACTOR_SINUOSIDAD;
  let libre: number;
  if (p.modo === 'a_pie') libre = distancia / VELOCIDAD_A_PIE_MS;
  else libre = p.siguioCalles && p.duracionLibreS > 0 ? p.duracionLibreS : distancia / VELOCIDAD_VEHICULO_MS;
  const f = FACTORES[p.modo][franja];
  const arranque = ARRANQUE_S[p.modo];
  return { probableS: Math.round(libre * f.probable + arranque), pesimistaS: Math.round(libre * f.pesimista + arranque), franja };
}

export function distanciaRectaM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "4 min", "1 h 05 min"; menos de un minuto = "< 1 min". */
export function formatoDuracion(s: number): string {
  if (s < 60) return '< 1 min';
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

export function formatoHora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz' });
}
