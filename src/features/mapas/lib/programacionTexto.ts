import { DIAS_SEMANA, type EstadoHorario, type HorarioAgenda, type MotivoDescarte, type VentanaProgramada } from '@/types/programacion';

// Textos de la programación de rutas (F5): días, horas y estado de cada
// horario, siempre en hora de Bolivia (la del servidor de programaciones).

const ZONA = 'America/La_Paz';

/** Fecha local (AAAA-MM-DD) de un instante. */
export function diaLocal(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** HH:MM local de un instante ISO. */
export function horaLocal(iso: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
}

/** «Hoy», «Mañana» o «Vie 17/10». */
export function etiquetaDia(fecha: string, hoy = diaLocal()): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  const d = new Date(`${fecha}T12:00:00.000Z`);
  const dia = d.toLocaleDateString('es-BO', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${fecha.slice(8, 10)}/${fecha.slice(5, 7)}`;
}

/** Días compactos: «Todos los días», «L–V», «S–D» o «L, X, V». */
export function diasTexto(dias: number[]): string {
  const orden = [...new Set(dias)].sort();
  if (orden.length === 7) return 'Todos los días';
  const corto = (d: number) => DIAS_SEMANA.find((x) => x.id === d)?.corto ?? String(d);
  const consecutivos = orden.length >= 3 && orden.every((d, i) => i === 0 || d === orden[i - 1]! + 1);
  if (consecutivos) return `${corto(orden[0]!)}–${corto(orden[orden.length - 1]!)}`;
  return orden.map(corto).join(', ');
}

/** «06:00–14:00», «22:00–06:00 (+1 día)», «07:00 · 24 h». */
export function rangoVentana(v: Pick<VentanaProgramada, 'horaInicio' | 'horaFin' | 'duracionMin' | 'cruzaMedianoche'>): string {
  if (v.duracionMin === 1440) return `${v.horaInicio} · 24 h`;
  return `${v.horaInicio}–${v.horaFin}${v.cruzaMedianoche ? ' (+1 día)' : ''}`;
}

/** Duración en minutos entre dos HH:MM; si el fin es menor o igual, termina al día siguiente (igual = 24 h). */
export function duracionEntre(inicio: string, fin: string): number {
  const m = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
  const d = m(fin) - m(inicio);
  return d > 0 ? d : d + 1440;
}

export function horaMas(inicio: string, minutos: number): string {
  const total = (Number(inicio.slice(0, 2)) * 60 + Number(inicio.slice(3, 5)) + minutos) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export type TonoHorario = 'gris' | 'azul' | 'rojo' | 'ambar' | 'verde';

/** Estado visible de un horario de la agenda (qué le pasa y si falta algo). */
export function estadoVisible(h: Pick<HorarioAgenda, 'estado' | 'motivoCierre' | 'inicio' | 'apertura'>, ahora = Date.now()): { texto: string; tono: TonoHorario } {
  const empezo = new Date(h.inicio).getTime() <= ahora;
  const e: EstadoHorario = h.estado;
  switch (e) {
    case 'programada':
      return { texto: `Se abre a las ${horaLocal(h.apertura)}`, tono: 'gris' };
    case 'por_abrir':
      return { texto: 'Por abrir', tono: 'gris' };
    case 'no_abierta':
      return { texto: 'No se abrió', tono: 'gris' };
    case 'pendiente':
      return empezo ? { texto: 'Sin asignar', tono: 'rojo' } : { texto: `Preparar · empieza ${horaLocal(h.inicio)}`, tono: 'azul' };
    case 'incompleta':
      return { texto: 'Incompleto', tono: 'ambar' };
    case 'activa':
      return { texto: 'Cubierto', tono: 'verde' };
    case 'cancelada':
      return { texto: 'Cancelado', tono: 'gris' };
    case 'finalizada':
      if (h.motivoCierre === 'sin_cubrir') return { texto: 'Sin cubrir', tono: 'rojo' };
      if (h.motivoCierre === 'cubierta_parcial') return { texto: 'Cubierto a medias', tono: 'ambar' };
      return { texto: 'Cubierto', tono: 'verde' };
    default:
      return { texto: e, tono: 'gris' };
  }
}

export const CLASE_TONO: Record<TonoHorario, string> = {
  gris: 'bg-neutral-bg text-neutral-text-muted',
  azul: 'bg-primary-100 text-primary-800',
  rojo: 'bg-risk-critical/10 text-risk-critical',
  ambar: 'bg-risk-medium/15 text-[#B45309]',
  verde: 'bg-risk-low/15 text-[#15803D]',
};

// --- F6: asignación automática ---------------------------------------------

/** Por qué la automática no eligió a un guardia (en palabras del operador). */
export const MOTIVO_DESCARTE: Record<MotivoDescarte, string> = {
  sos: 'con SOS',
  sin_turno: 'fuera de servicio',
  ocupado: 'ya tiene ruta',
  retirado: 'retirado de este horario',
  sin_gps: 'sin GPS',
  gps_antiguo: 'GPS de más de 10 min',
  gps_impreciso: 'GPS impreciso',
  bateria_baja: 'batería baja',
  bateria_desconocida: 'batería desconocida',
  fuera_de_radio: 'fuera del radio',
  ruta_llena: 'cupo lleno',
  punto_lleno: 'punto lleno',
  ya_en_esta_ruta: 'ya está en el horario',
  cuenta_inactiva: 'cuenta inactiva',
};

/** «3 GPS de más de 10 min, 1 fuera del radio». */
export function descartesTexto(d: Partial<Record<MotivoDescarte, number>>): string {
  return Object.entries(d)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([m, n]) => `${n} ${MOTIVO_DESCARTE[m as MotivoDescarte] ?? m}`)
    .join(', ');
}

/** «1,2 km» o «450 m». */
export function distanciaTexto(m: number | null | undefined): string {
  if (m == null) return '—';
  return m >= 1000 ? `${(m / 1000).toLocaleString('es-BO', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`;
}

/** ¿Se le pueden asignar guardias todavía? (abierto y con cupo libre). */
export function admiteAsignar(h: Pick<HorarioAgenda, 'ejecucionId' | 'estado' | 'cupo' | 'asignados' | 'fin'>, ahora = Date.now()): boolean {
  return Boolean(h.ejecucionId) && ['pendiente', 'incompleta', 'activa'].includes(h.estado) && h.asignados < h.cupo && new Date(h.fin).getTime() > ahora;
}
