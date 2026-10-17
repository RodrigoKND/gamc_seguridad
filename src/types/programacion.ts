// Programación manual de rutas (F5): una ruta guardada/predeterminada o un
// punto fijo con uno o más horarios. El servidor abre cada horario 15 min
// antes como una tarea "pendiente" y el operador le asigna los guardias.
// La agenda y los avisos vienen del backend (fuente de verdad).
//
// F6: una programación puede ser AUTOMÁTICA: el servidor asigna a los
// guardias libres más cercanos (radio de 3 km que crece solo) y reintenta si
// faltan. Si el operador retira a un guardia puede elegir él al reemplazo
// (un momento); el horario sigue siendo automático.

/** 1 = lunes … 7 = domingo (ISO). */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const DIAS_SEMANA: { id: DiaSemana; corto: string; largo: string }[] = [
  { id: 1, corto: 'L', largo: 'Lunes' },
  { id: 2, corto: 'M', largo: 'Martes' },
  { id: 3, corto: 'X', largo: 'Miércoles' },
  { id: 4, corto: 'J', largo: 'Jueves' },
  { id: 5, corto: 'V', largo: 'Viernes' },
  { id: 6, corto: 'S', largo: 'Sábado' },
  { id: 7, corto: 'D', largo: 'Domingo' },
];

export interface VentanaProgramada {
  id: string;
  dias: DiaSemana[];
  /** HH:MM, hora de Bolivia. */
  horaInicio: string;
  horaFin: string;
  duracionMin: number;
  /** Termina al día siguiente (turno nocturno o de 24 h). */
  cruzaMedianoche: boolean;
  cupo: number;
}

export type EstadoProgramacion = 'activa' | 'pausada' | 'archivada';

/** F6: quién asigna los guardias de cada horario. */
export type ModoAsignacion = 'manual' | 'automatica';

export interface ProgramacionRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  epiCodigo: string | null;
  epiNombre: string | null;
  objetivo: { tipo: 'ruta' | 'punto'; id: string; nombre: string; activo: boolean };
  modalidad: string;
  /** Máximo de guardias por horario (el de la modalidad, o la capacidad del punto). */
  cupoMax: number;
  modo: ModoAsignacion;
  /** Radio inicial (m) de la búsqueda automática; lo fija el sistema. */
  radioMaxM: number | null;
  estado: EstadoProgramacion;
  origen: 'manual' | 'prueba';
  version: number;
  creadoPor: string | null;
  ventanas: VentanaProgramada[];
  proximo: { inicio: string; fin: string } | null;
}

export interface VentanaBody {
  id?: string;
  dias: number[];
  horaInicio: string;
  duracionMin: number;
  cupo: number;
}

export interface ProgramacionBody {
  nombre?: string | null;
  descripcion?: string | null;
  rutaPlantillaId?: string;
  puntoFijoId?: string;
  estado?: 'activa' | 'pausada';
  modo?: ModoAsignacion;
  ventanas?: VentanaBody[];
}

/**
 * Estado de un horario en la agenda: `programada` (aún no se abre),
 * `por_abrir` (debió abrirse: planificador pausado), `no_abierta` (terminó
 * sin abrirse) o el de su ejecución.
 */
export type EstadoHorario = 'programada' | 'por_abrir' | 'no_abierta' | 'pendiente' | 'incompleta' | 'activa' | 'finalizada' | 'cancelada';

export interface GuardiaHorario {
  patrullaId: string;
  guardiaId: string;
  guardiaNombre: string;
  /** asignada = espera el inicio del horario; en_curso = ya en servicio. */
  estado: string;
  puntoFijoId: string | null;
}

export interface HorarioAgenda {
  clave: string;
  ejecucionId: string | null;
  programacionId: string;
  ventanaId: string;
  nombre: string;
  epiCodigo: string | null;
  modalidad: string;
  rutaPlantillaId: string | null;
  puntoFijoId: string | null;
  fechaLocal: string;
  inicio: string;
  fin: string;
  apertura: string;
  cupo: number;
  estado: EstadoHorario;
  /** Al cerrar: cubierta / cubierta_parcial / sin_cubrir / cancelada_por_usuario. */
  motivoCierre: string | null;
  asignados: number;
  atendieron: number;
  guardias: GuardiaHorario[];
  asignacionModo: ModoAsignacion;
  /** Solo en horarios automáticos abiertos o cerrados. */
  automatica: EstadoAutomatica | null;
}

/** Motivos por los que la asignación automática descarta a un guardia. */
export type MotivoDescarte =
  | 'sos'
  | 'sin_turno'
  | 'ocupado'
  | 'retirado'
  | 'sin_gps'
  | 'gps_antiguo'
  | 'gps_impreciso'
  | 'bateria_baja'
  | 'bateria_desconocida'
  | 'fuera_de_radio'
  | 'ruta_llena'
  | 'punto_lleno'
  | 'ya_en_esta_ruta'
  | 'cuenta_inactiva';

export interface EstadoAutomatica {
  /** Radio de búsqueda actual (empieza en 3 km y crece solo). */
  radioM: number | null;
  intentos: number;
  proximoIntento: string | null;
  /** Un operador está eligiendo a mano al reemplazo: la automática espera hasta esta hora. */
  reservaHasta: string | null;
  ultimo: {
    en: string;
    asignados: number;
    faltan: number;
    candidatos: number;
    radioM?: number;
    elegidos: { guardiaId: string; nombre: string; distanciaM: number | null }[];
    descartes: Partial<Record<MotivoDescarte, number>>;
    error?: string;
  } | null;
}

/** Detalle de los intentos automáticos de un horario (a quién eligió y descartó, y por qué). */
export interface IntentosAutomaticos {
  ejecucionId: string;
  automatica: boolean;
  intentos: {
    id: string;
    intento: number;
    ejecutadoEn: string;
    asignados: number;
    faltan: number;
    candidatos: number;
    radioM: number | null;
    elegidos: { guardiaId: string; nombre: string; distanciaM: number | null }[];
    excluidos: { guardiaId: string; nombre: string; motivo: MotivoDescarte; distanciaM: number | null; gpsEdadMin?: number | null; bateria?: number | null; alAsignar?: boolean }[];
    error: string | null;
  }[];
}

export interface AvisoProgramacion {
  ejecucionId: string;
  programacionId: string;
  nombre: string;
  epiCodigo: string | null;
  modalidad: string;
  puntoFijoId: string | null;
  inicio: string;
  fin: string;
  cupo: number;
  asignados: number;
  faltan: number;
  empezado: boolean;
  /** F6: horario automático (el sistema sigue buscando), su radio actual y cuándo vuelve a intentar. */
  automatica: boolean;
  radioM: number | null;
  proximoIntento: string | null;
}

export interface EstadoPlanificador {
  habilitado: boolean;
  ultimaPasada: string | null;
  ultimaPasadaOk: string | null;
  ultimoError: string | null;
  cambiadoEn: string | null;
  motivo: string | null;
  intervaloSeg: number;
  aperturaAnticipadaMin: number;
  horariosAbiertos: number;
  registros: {
    id: string;
    inicio: string;
    abiertas: number;
    iniciadas: number;
    cerradas: number;
    perdidas: number;
    omitidas: number;
    errores: number;
  }[];
}

/** Horario programado elegido para asignarle guardias (abre el asistente vinculado a él). */
export interface HorarioParaAsignar {
  ejecucionId: string;
  nombre: string;
  modalidad: string;
  puntoFijoId: string | null;
  rutaPlantillaId: string | null;
  inicio: string;
  fin: string;
  cupo: number;
  asignados: number;
}
