'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CalendarClock, ChevronDown, Flag, Pause, Pencil, Play, Plus, Route as RouteIcon, Trash2, UserPlus, XCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useDialog } from '@/components/ui/AlertDialog';
import { EpiNombre } from '@/lib/epis/EpiNombre';
import { getAgendaProgramada, getIntentosAutomaticos, getPlanificador, getProgramaciones, revalidarHorariosEnVivo } from '@/lib/data-source';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import type { RutaPlantillaRow } from '@/types/patrulla';
import type { PuntoFijoRow } from '@/types/puntoFijo';
import type { EstadoPlanificador, HorarioAgenda, HorarioParaAsignar, IntentosAutomaticos, ProgramacionBody, ProgramacionRow } from '@/types/programacion';
import { puedeEditarEn, type Jurisdiccion } from '../../lib/jurisdiccion';
import {
  CLASE_TONO,
  MOTIVO_DESCARTE,
  admiteAsignar,
  descartesTexto,
  diaLocal,
  diasTexto,
  distanciaTexto,
  etiquetaDia,
  estadoVisible,
  horaLocal,
  rangoVentana,
  sumarDias,
} from '../../lib/programacionTexto';
import { createProgramacionAction, deleteProgramacionAction, setPlanificadorAction, updateProgramacionAction } from '../../actions/programacion';
import { cancelRouteAction } from '../../actions/cancelRoute';
import { ProgramacionEditor } from './ProgramacionEditor';

// Menú "Rutas" → "Programar Rutas" (F5). Dos pestañas:
//  · Agenda: solo Hoy y Mañana (lo de ayer no se muestra: ya no admite
//    acciones). Un turno de noche que empezó ayer y sigue en curso aparece
//    en Hoy. Cada horario con su estado (se abre 15 min
//    antes, sin asignar, incompleto, cubierto, sin cubrir…) y el botón
//    "Asignar guardias", que abre el asistente vinculado a ESE horario.
//  · Programaciones: qué ruta o punto fijo se cubre, con qué días y horas;
//    crear, editar, pausar/reanudar (un solo botón) y eliminar. Al crearla
//    queda activa; las pausadas van al final de la lista.
// Las tareas pendientes sin guardias no aparecen en el mapa en vivo: solo acá
// y en la campana. Todo viene segmentado por EPI desde el backend.
//
// F6: un horario AUTOMÁTICO se gestiona solo: muestra cómo va (radio de
// búsqueda, cuántos faltan, descartados por motivo) y no ofrece «Asignar
// guardias». Tocar CUALQUIER parte de una tarjeta la despliega con toda su
// información (guardias, modo, intentos: a quién eligió y por qué) y su
// acción (cancelar). En la pestaña
// Programaciones, tocar una tarjeta muestra su ficha a la derecha.

type Pestana = 'agenda' | 'programaciones';

export interface RutasProgramadasModalProps {
  isOpen: boolean;
  onClose: () => void;
  jurisdiccion: Jurisdiccion | null;
  rutas: RutaPlantillaRow[];
  puntos: PuntoFijoRow[];
  /** Crear/editar programaciones (Operador y Super Admin). */
  puedeProgramar: boolean;
  /** Asignar guardias / cancelar horarios (permiso de patrullaje). */
  puedeAsignar: boolean;
  esSuperAdmin: boolean;
  /** Horario a resaltar al abrir (desde la campana). */
  enfocarEjecucionId?: string | null;
  onAsignar: (h: HorarioParaAsignar) => void;
  /** Recarga el mapa tras cancelar un horario. */
  onCambio: () => void;
}

function hace(iso: string | null): string {
  if (!iso) return 'nunca';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return `hace ${s} s`;
  const m = Math.round(s / 60);
  return m < 90 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
}

export function RutasProgramadasModal({
  isOpen,
  onClose,
  jurisdiccion,
  rutas,
  puntos,
  puedeProgramar,
  puedeAsignar,
  esSuperAdmin,
  enfocarEjecucionId,
  onAsignar,
  onCambio,
}: RutasProgramadasModalProps) {
  const dialogo = useDialog();
  const [pestana, setPestana] = useState<Pestana>('agenda');
  const [dia, setDia] = useState(diaLocal());
  const [agenda, setAgenda] = useState<HorarioAgenda[]>([]);
  const [programaciones, setProgramaciones] = useState<ProgramacionRow[]>([]);
  const [planificador, setPlanificador] = useState<EstadoPlanificador | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ programacion: ProgramacionRow | null } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorEditor, setErrorEditor] = useState<string | null>(null);
  const [, setReloj] = useState(0);
  const enfocadoRef = useRef<HTMLLIElement | null>(null);
  // F6: tarjeta desplegada de la agenda (por su clave) y los intentos automáticos de su horario.
  const [abierta, setAbierta] = useState<string | null>(null);
  const [intentos, setIntentos] = useState<{ ejecucionId: string; datos: IntentosAutomaticos | null; error: boolean } | null>(null);
  // Programación elegida en la pestaña Programaciones (su ficha, a la derecha).
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  async function cargarIntentos(ejecucionId: string) {
    setIntentos((d) => (d?.ejecucionId === ejecucionId ? d : { ejecucionId, datos: null, error: false }));
    try {
      const datos = await getIntentosAutomaticos(ejecucionId);
      setIntentos((d) => (d?.ejecucionId === ejecucionId ? { ejecucionId, datos, error: false } : d));
    } catch {
      setIntentos((d) => (d?.ejecucionId === ejecucionId ? { ejecucionId, datos: null, error: true } : d));
    }
  }

  function alternarTarjeta(h: HorarioAgenda) {
    if (abierta === h.clave) {
      setAbierta(null);
      return;
    }
    setAbierta(h.clave);
    if (h.ejecucionId && h.automatica) void cargarIntentos(h.ejecucionId);
  }

  /** Una línea con cómo va la automática (sin abrir la tarjeta). */
  function lineaAutomatica(h: HorarioAgenda, abierto: boolean) {
    if (h.asignacionModo !== 'automatica') return null;
    const a = h.automatica;
    let texto: string;
    let alerta = false;
    if (!a) texto = 'Automática: asigna sola al abrirse el horario.';
    else if (abierto && a.reservaHasta) texto = `Automática · un operador está eligiendo el reemplazo; si no, sigue sola a las ${horaLocal(a.reservaHasta)}`;
    else if (!a.ultimo) texto = 'Automática: buscando guardias…';
    else {
      // Lo que falta se cuenta con los guardias de AHORA (el último intento puede ser anterior a una asignación).
      const u = a.ultimo;
      const faltanAhora = Math.max(0, h.cupo - h.asignados);
      const buscando = abierto && faltanAhora > 0;
      // Cerrado o cancelado: solo el historial (ni "completo" ni "buscando").
      const partes = [buscando ? `Automática · faltan ${faltanAhora}, buscando en ${distanciaTexto(a.radioM)}` : abierto ? 'Automática · completo' : 'Automática'];
      partes.push(`último intento ${horaLocal(u.en)}: asignó ${u.asignados}`);
      const desc = descartesTexto(u.descartes);
      if (buscando && desc) partes.push(`descartados: ${desc}`);
      if (u.error) partes.push(`error: ${u.error}`);
      texto = partes.join(' · ');
      alerta = buscando;
    }
    return (
      <p className={`mt-0.5 flex flex-wrap items-center gap-1 text-[11px] ${alerta ? 'text-[#B45309]' : 'text-neutral-text-muted'}`}>
        <Bot className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span>{texto}</span>
      </p>
    );
  }

  /** Información completa de un horario (tarjeta desplegada). */
  function fichaHorario(h: HorarioAgenda, abierto: boolean, editable: boolean) {
    const programacion = programaciones.find((p) => p.id === h.programacionId);
    const filas: [string, React.ReactNode][] = [
      [h.puntoFijoId ? 'Punto fijo' : 'Ruta', programacion?.objetivo.nombre ?? h.nombre],
      ['Horario', `${etiquetaDia(h.fechaLocal, hoy)} ${horaLocal(h.inicio)}–${horaLocal(h.fin)} · se abre a las ${horaLocal(h.apertura)}`],
      ['Guardias', `${['finalizada', 'cancelada', 'no_abierta'].includes(h.estado) ? `atendieron ${h.atendieron}` : `${h.asignados} asignado(s)`} de ${h.cupo}`],
      [
        'Asignación',
        h.asignacionModo === 'automatica' ? `Automática${h.automatica?.radioM ? ` · radio de búsqueda ${distanciaTexto(h.automatica.radioM)}` : ''}` : 'Manual',
      ],
    ];
    if (h.motivoCierre) filas.push(['Cierre', estadoVisible(h).texto]);
    const datos = intentos?.ejecucionId === h.ejecucionId ? intentos : null;
    const intento = datos?.datos?.intentos[0];
    return (
      <div className="mt-2 rounded-md border border-neutral-border bg-white p-2.5 text-[11.5px]" onClick={(e) => e.stopPropagation()}>
        <dl className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-2 gap-y-1">
          {filas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-neutral-text-muted">{k}</dt>
              <dd className="text-neutral-text">{v}</dd>
            </div>
          ))}
        </dl>
        {h.guardias.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {h.guardias.map((g) => (
              <li key={g.patrullaId} className="flex items-center gap-1.5 text-neutral-text">
                <span className={`h-1.5 w-1.5 rounded-full ${g.estado === 'asignada' ? 'bg-primary-700' : 'bg-risk-low'}`} aria-hidden="true" />
                {g.guardiaNombre}
                <span className="text-neutral-text-muted">· {g.estado === 'asignada' ? `empieza a las ${horaLocal(h.inicio)}` : 'en servicio'}</span>
              </li>
            ))}
          </ul>
        )}
        {h.automatica && (
          <div className="mt-2 border-t border-neutral-bg pt-2">
            {datos?.error ? (
              <p className="text-risk-critical">No se pudo cargar el detalle de la asignación automática.</p>
            ) : !datos?.datos ? (
              <p className="text-neutral-text-muted">Cargando la asignación automática…</p>
            ) : !intento ? (
              <p className="text-neutral-text-muted">Todavía no hay intentos registrados.</p>
            ) : (
              <>
                <p className="mb-1 font-semibold text-neutral-text">
                  Último intento registrado ({horaLocal(intento.ejecutadoEn)}): {intento.candidatos} apto(s){intento.radioM ? ` en ${distanciaTexto(intento.radioM)}` : ''}, asignó {intento.asignados}
                  {intento.faltan > 0 ? `, faltaron ${intento.faltan}` : ''}
                </p>
                {intento.elegidos.length > 0 && (
                  <p className="text-neutral-text">Elegidos (los más cercanos): {intento.elegidos.map((g) => `${g.nombre} (${distanciaTexto(g.distanciaM)})`).join(', ')}</p>
                )}
                {intento.excluidos.length > 0 && (
                  <ul className="mt-1 max-h-[130px] space-y-0.5 overflow-y-auto text-neutral-text-muted">
                    {intento.excluidos.map((x) => (
                      <li key={`${x.guardiaId}-${x.motivo}`}>
                        {x.nombre}: {MOTIVO_DESCARTE[x.motivo] ?? x.motivo}
                        {x.distanciaM != null ? ` · a ${distanciaTexto(x.distanciaM)}` : ''}
                        {x.alAsignar ? ' (al confirmar)' : ''}
                      </li>
                    ))}
                  </ul>
                )}
                {intento.error && <p className="mt-1 text-risk-critical">Error: {intento.error}</p>}
              </>
            )}
          </div>
        )}
        {abierto && editable && (
          <div className="mt-2.5 flex flex-wrap gap-2 border-t border-neutral-bg pt-2.5">
            <Button type="button" variant="secondary" onClick={() => void cancelarHorario(h)} className="!text-risk-critical">
              <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Cancelar horario
            </Button>
          </div>
        )}
      </div>
    );
  }

  const hoy = diaLocal();
  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const [a, p, e] = await Promise.all([getAgendaProgramada(sumarDias(diaLocal(), -1), sumarDias(diaLocal(), 1)), getProgramaciones(), getPlanificador().catch(() => null)]);
      setAgenda(a);
      setProgramaciones(p);
      setPlanificador(e);
      setError(null);
    } catch {
      setError('No se pudo cargar la programación de rutas.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPestana('agenda');
    setDia(diaLocal());
    setEditor(null);
    setErrorEditor(null);
    setAbierta(null);
    setSeleccionId(null);
    void recargar();
    // Los estados dependen de la hora (se abre, empieza, termina): refresco suave cada 30 s.
    const iv = setInterval(() => {
      setReloj((n) => n + 1);
      // Pasó la medianoche con la agenda abierta: el día elegido no puede quedar en "ayer".
      setDia((d) => (d < diaLocal() ? diaLocal() : d));
      void recargar();
    }, 30_000);
    return () => clearInterval(iv);
  }, [isOpen, recargar]);

  // Tiempo real: el planificador abrió o cerró un horario, o alguien asignó.
  const alEvento = useCallback(() => {
    if (isOpen) void recargar();
  }, [isOpen, recargar]);
  // Lo cambió el servidor (planificador): invalidar la caché antes de recargar.
  const alEventoPlanificador = useCallback(() => {
    if (isOpen) void revalidarHorariosEnVivo().finally(() => void recargar());
  }, [isOpen, recargar]);
  useRealtimeEvent(REALTIME_EVENTS.programacionActualizada, alEventoPlanificador);
  useRealtimeEvent(REALTIME_EVENTS.patrullaAsignada, alEvento);
  useRealtimeEvent(REALTIME_EVENTS.patrullaCancelada, alEvento);

  // Desde la campana: ir al día del horario y resaltarlo.
  const enfocado = enfocarEjecucionId ? agenda.find((h) => h.ejecucionId === enfocarEjecucionId) : undefined;
  useEffect(() => {
    if (!isOpen || !enfocado) return;
    setPestana('agenda');
    // Un turno de noche que empezó ayer se muestra en Hoy.
    setDia(enfocado.fechaLocal < diaLocal() ? diaLocal() : enfocado.fechaLocal);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando llega el horario pedido
  }, [isOpen, enfocado?.ejecucionId]);
  useEffect(() => {
    enfocadoRef.current?.scrollIntoView({ block: 'center' });
  }, [dia, enfocado?.ejecucionId]);

  // La tarjeta abierta de un horario automático se mantiene al día con cada recarga.
  useEffect(() => {
    const h = abierta ? agenda.find((x) => x.clave === abierta) : undefined;
    if (h?.ejecucionId && h.automatica) void cargarIntentos(h.ejecucionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando llega una agenda nueva
  }, [agenda]);

  // Hoy incluye el turno de noche de ayer que SIGUE ABIERTO; lo de ayer ya cerrado o cancelado no se muestra.
  const delDia = useMemo(
    () =>
      agenda.filter(
        (h) =>
          h.fechaLocal === dia ||
          (dia === hoy && h.fechaLocal < hoy && ['pendiente', 'incompleta', 'activa'].includes(h.estado) && new Date(h.fin).getTime() > Date.now()),
      ),
    [agenda, dia, hoy],
  );
  // Activas primero; las pausadas, al final (el backend ya las ordena así).
  const listaProgramaciones = useMemo(
    () => [...programaciones].sort((a, b) => Number(a.estado === 'pausada') - Number(b.estado === 'pausada')),
    [programaciones],
  );
  // Horarios abiertos con cupo por cubrir (en cualquier día de la agenda): resumen arriba.
  const faltan = agenda.filter((h) => admiteAsignar(h) && (h.estado === 'pendiente' || h.estado === 'incompleta')).length;

  async function guardarProgramacion(body: ProgramacionBody) {
    setGuardando(true);
    setErrorEditor(null);
    const r = editor?.programacion ? await updateProgramacionAction(editor.programacion.id, body) : await createProgramacionAction(body);
    setGuardando(false);
    if (!r.success) {
      setErrorEditor(r.error ?? 'No se pudo guardar.');
      return;
    }
    setEditor(null);
    await recargar();
  }

  async function cambiarEstado(p: ProgramacionRow) {
    const pausar = p.estado === 'activa';
    if (pausar) {
      const ok = await dialogo.confirmar({
        tono: 'advertencia',
        titulo: `¿Pausar «${p.nombre}»?`,
        mensaje: 'No se abrirán nuevos horarios hasta reanudarla. El que ya está abierto sigue.',
        textoConfirmar: 'Pausar',
      });
      if (!ok) return;
    }
    const r = await updateProgramacionAction(p.id, { estado: pausar ? 'pausada' : 'activa' });
    if (!r.success) await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo cambiar', mensaje: r.error });
    await recargar();
  }

  async function eliminar(p: ProgramacionRow) {
    // Horario de esta programación abierto ahora: se cancela junto con ella.
    const abiertos = agenda.filter((h) => h.programacionId === p.id && h.ejecucionId && ['pendiente', 'incompleta', 'activa'].includes(h.estado));
    const guardias = abiertos.flatMap((h) => h.guardias);
    const ok = await dialogo.confirmar({
      tono: 'peligro',
      titulo: `¿Eliminar «${p.nombre}»?`,
      mensaje:
        abiertos.length > 0
          ? `Deja de abrir horarios y se cancela el horario abierto (${abiertos.map((h) => `${horaLocal(h.inicio)}–${horaLocal(h.fin)}`).join(', ')})${guardias.length > 0 ? '; sus guardias quedan libres' : ''}. Los horarios ya terminados se conservan en el historial.`
          : 'Deja de abrir horarios y sale de la lista. Los horarios ya terminados se conservan en el historial.',
      detalles: guardias.map((g) => ({ titulo: g.guardiaNombre, tono: 'advertencia' as const })),
      textoConfirmar: 'Eliminar',
      destructivo: true,
    });
    if (!ok) return;
    const r = await deleteProgramacionAction(p.id);
    if (!r.success) await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo eliminar', mensaje: r.error });
    if (editor?.programacion?.id === p.id) setEditor(null);
    if (seleccionId === p.id) setSeleccionId(null);
    await recargar();
    if (abiertos.length > 0) onCambio();
  }

  async function cancelarHorario(h: HorarioAgenda) {
    const ok = await dialogo.confirmar({
      tono: 'peligro',
      titulo: `¿Cancelar el horario de «${h.nombre}» (${horaLocal(h.inicio)}–${horaLocal(h.fin)})?`,
      mensaje: `Es una ruta programada${h.asignacionModo === 'automatica' ? ' automática' : ''}: el horario queda cancelado y no se vuelve a abrir hoy${h.asignados > 0 ? '; sus guardias quedan libres' : ''}. Quedará registrado como cancelado, no como cubierto. ¿Estás seguro?`,
      detalles: h.guardias.map((g) => ({ titulo: g.guardiaNombre, tono: 'advertencia' as const })),
      textoConfirmar: 'Cancelar horario',
      destructivo: true,
    });
    if (!ok || !h.ejecucionId) return;
    const r = await cancelRouteAction(h.ejecucionId);
    if (!r.success) await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo cancelar', mensaje: r.error });
    await recargar();
    onCambio();
  }

  async function alternarPlanificador() {
    if (!planificador) return;
    const pausar = planificador.habilitado;
    if (pausar) {
      const ok = await dialogo.confirmar({
        tono: 'peligro',
        titulo: '¿Pausar el planificador en TODAS las EPIs?',
        mensaje: 'Dejará de abrir horarios programados hasta reanudarlo. Los que ya están abiertos siguen y se cierran a su hora.',
        textoConfirmar: 'Pausar planificador',
        destructivo: true,
      });
      if (!ok) return;
    }
    const r = await setPlanificadorAction(!pausar);
    if (!r.success) await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo cambiar el planificador', mensaje: r.error });
    else setPlanificador(r.estado ?? null);
  }

  function filaHorario(h: HorarioAgenda) {
    const ev = estadoVisible(h);
    const editable = puedeAsignar && puedeEditarEn(jurisdiccion, h.epiCodigo);
    // Lo que ya terminó es solo para mirar: sin acciones.
    const abierto = h.ejecucionId && ['pendiente', 'incompleta', 'activa'].includes(h.estado) && new Date(h.fin).getTime() > Date.now();
    const deAyer = h.fechaLocal < hoy;
    const esEnfocado = h.ejecucionId != null && h.ejecucionId === enfocarEjecucionId;
    const Icono = h.puntoFijoId ? Flag : RouteIcon;
    const cruza = horaLocal(h.fin) <= horaLocal(h.inicio) || new Date(h.fin).getTime() - new Date(h.inicio).getTime() >= 86_400_000;
    const desplegada = abierta === h.clave;
    return (
      <li
        key={h.clave}
        ref={esEnfocado ? enfocadoRef : undefined}
        role="button"
        tabIndex={0}
        aria-expanded={desplegada}
        onClick={() => alternarTarjeta(h)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          alternarTarjeta(h);
        }}
        className={[
          'flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-neutral-bg/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600',
          esEnfocado ? 'bg-accent-500/10 ring-1 ring-inset ring-accent-500/40' : '',
          desplegada ? 'bg-neutral-bg/60' : '',
        ].join(' ')}
      >
        <div className="w-[92px] shrink-0 pt-0.5 text-[12.5px] font-semibold tabular-nums text-primary-900">
          {horaLocal(h.inicio)}–{horaLocal(h.fin)}
          {cruza && (
            <span className="block text-[10.5px] font-normal text-neutral-text-muted">
              {deAyer ? 'empezó ayer' : new Date(h.fin).getTime() - new Date(h.inicio).getTime() >= 86_400_000 ? '24 h' : '+1 día'}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-neutral-text">
            <Icono className="h-3.5 w-3.5 shrink-0 text-primary-700" aria-hidden="true" />
            <span className="truncate">{h.nombre}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${CLASE_TONO[ev.tono]}`}>{ev.texto}</span>
            {h.asignacionModo === 'automatica' && <span className="rounded bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-800">Auto</span>}
            {(!jurisdiccion?.restringido) && h.epiCodigo && (
              <span className="text-[10.5px] font-normal text-neutral-text-muted">
                · <EpiNombre codigo={h.epiCodigo} />
              </span>
            )}
          </p>
          <p className="text-[11.5px] text-neutral-text-muted">
            {['finalizada', 'cancelada', 'no_abierta'].includes(h.estado)
              ? `Atendieron ${h.atendieron} de ${h.cupo} guardia(s)`
              : `${h.asignados}/${h.cupo} guardia(s)`}
            {h.guardias.length > 0 && ` — ${h.guardias.map((g) => (g.estado === 'asignada' ? `${g.guardiaNombre} (desde las ${horaLocal(h.inicio)})` : g.guardiaNombre)).join(', ')}`}
          </p>
          {lineaAutomatica(h, Boolean(abierto))}
          {desplegada && fichaHorario(h, Boolean(abierto), editable)}
        </div>
        {editable && abierto && (
          <span className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {/* Automático: el sistema asigna solo; no se ofrece asignar a mano (salvo pasarlo a manual). */}
            {admiteAsignar(h) && h.asignacionModo !== 'automatica' && (
              <Button
                type="button"
                variant={h.estado === 'activa' ? 'secondary' : 'brand'}
                onClick={() =>
                  onAsignar({
                    ejecucionId: h.ejecucionId!,
                    nombre: h.nombre,
                    modalidad: h.modalidad,
                    puntoFijoId: h.puntoFijoId,
                    rutaPlantillaId: h.rutaPlantillaId,
                    inicio: h.inicio,
                    fin: h.fin,
                    cupo: h.cupo,
                    asignados: h.asignados,
                  })
                }
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
                Asignar guardias
              </Button>
            )}
            <button
              type="button"
              onClick={() => void cancelarHorario(h)}
              aria-label={`Cancelar horario de ${h.nombre}`}
              title="Cancelar este horario"
              className="rounded p-1.5 text-neutral-text-muted hover:bg-risk-critical/10 hover:text-risk-critical focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </button>
          </span>
        )}
        <ChevronDown className={`mt-1 h-3.5 w-3.5 shrink-0 text-neutral-text-muted transition-transform ${desplegada ? 'rotate-180' : ''}`} aria-hidden="true" />
      </li>
    );
  }

  const fichaElegida = seleccionId ? programaciones.find((p) => p.id === seleccionId) ?? null : null;

  /** Ficha de una programación: qué cubre, modo, horarios, próximos horarios de la agenda y acciones. */
  function fichaProgramacion(p: ProgramacionRow) {
    const editable = puedeProgramar && puedeEditarEn(jurisdiccion, p.epiCodigo);
    // Solo los que todavía pueden pasar (no los cancelados ni los ya cerrados).
    const proximos = agenda
      .filter((h) => h.programacionId === p.id && new Date(h.fin).getTime() > Date.now() && !['cancelada', 'finalizada', 'no_abierta'].includes(h.estado))
      .slice(0, 4);
    const filas: [string, React.ReactNode][] = [
      [p.objetivo.tipo === 'punto' ? 'Punto fijo' : 'Ruta', `${p.objetivo.nombre}${p.objetivo.activo ? '' : p.objetivo.tipo === 'punto' ? ' (desactivado)' : ' (archivada)'}`],
      ['EPI', p.epiCodigo ? <EpiNombre codigo={p.epiCodigo} /> : '—'],
      ['Estado', p.estado === 'activa' ? 'Activa' : 'Pausada: no abre horarios'],
      [
        'Asignación',
        p.modo === 'automatica'
          ? 'Automática · busca a 3 km y amplía 2 km cada 3 min sin nadie'
          : 'Manual: el operador asigna',
      ],
      ['Máximo', `${p.cupoMax} guardia(s) por horario`],
      ['Creada por', p.creadoPor ?? '—'],
    ];
    return (
      <div className="rounded-lg border border-neutral-border p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-primary-900">
          {p.objetivo.tipo === 'punto' ? <Flag className="h-4 w-4 text-primary-700" aria-hidden="true" /> : <RouteIcon className="h-4 w-4 text-primary-700" aria-hidden="true" />}
          {p.nombre}
        </p>
        <dl className="grid grid-cols-[90px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[12px]">
          {filas.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-neutral-text-muted">{k}</dt>
              <dd className="text-neutral-text">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-text-muted">Horarios</p>
        <ul className="space-y-0.5 text-[12px] text-neutral-text">
          {p.ventanas.map((v) => (
            <li key={v.id}>
              {diasTexto(v.dias)} · {rangoVentana(v)} · {v.cupo} guardia(s)
            </li>
          ))}
        </ul>
        <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-text-muted">Próximos horarios</p>
        {proximos.length === 0 ? (
          <p className="text-[12px] text-neutral-text-muted">{p.estado === 'activa' ? 'Ninguno hoy ni mañana.' : 'Pausada.'}</p>
        ) : (
          <ul className="space-y-1 text-[12px]">
            {proximos.map((h) => {
              const ev = estadoVisible(h);
              return (
                <li key={h.clave}>
                  <button
                    type="button"
                    onClick={() => {
                      setPestana('agenda');
                      setDia(h.fechaLocal < hoy ? hoy : h.fechaLocal);
                      setAbierta(h.clave);
                      if (h.ejecucionId && h.automatica) void cargarIntentos(h.ejecucionId);
                    }}
                    className="flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-neutral-bg"
                  >
                    <span className="tabular-nums text-neutral-text">
                      {etiquetaDia(h.fechaLocal, hoy)} {horaLocal(h.inicio)}–{horaLocal(h.fin)}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${CLASE_TONO[ev.tono]}`}>{ev.texto}</span>
                    <span className="text-neutral-text-muted">
                      {h.asignados}/{h.cupo}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {editable && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-bg pt-3">
            <Button type="button" variant="brand" onClick={() => { setErrorEditor(null); setEditor({ programacion: p }); }}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Editar
            </Button>
            <Button type="button" variant="secondary" onClick={() => void cambiarEstado(p)}>
              {p.estado === 'activa' ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
              {p.estado === 'activa' ? 'Pausar' : 'Reanudar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => void eliminar(p)} className="!text-risk-critical">
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Eliminar
            </Button>
          </div>
        )}
      </div>
    );
  }

  const dias = [hoy, sumarDias(hoy, 1)];
  const puedeCrear = puedeProgramar && Boolean(jurisdiccion && (!jurisdiccion.restringido || jurisdiccion.miEpi));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Programar Rutas" widthClassName="max-w-[980px]" accent="gold">
      <div className="p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Rutas programadas" className="flex rounded-lg bg-neutral-bg p-0.5">
            {(['agenda', 'programaciones'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={pestana === p}
                onClick={() => {
                  setPestana(p);
                  setEditor(null);
                }}
                className={[
                  'rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
                  pestana === p ? 'bg-white text-primary-900 shadow-sm' : 'text-neutral-text-muted hover:text-primary-900',
                ].join(' ')}
              >
                {p === 'agenda' ? 'Agenda' : 'Programaciones'}
                {p === 'agenda' && faltan > 0 && <span className="ml-1.5 rounded-full bg-risk-critical px-1.5 text-[10px] font-bold text-white">{faltan}</span>}
              </button>
            ))}
          </div>
          {planificador && (
            <span className="ml-auto flex items-center gap-2 text-[11.5px] text-neutral-text-muted">
              <span className={`h-2 w-2 rounded-full ${planificador.habilitado ? 'bg-risk-low' : 'bg-risk-critical'}`} aria-hidden="true" />
              {planificador.habilitado ? 'Planificador activo' : 'Planificador PAUSADO'} · revisó {hace(planificador.ultimaPasada)}
              {esSuperAdmin && (
                <button
                  type="button"
                  onClick={() => void alternarPlanificador()}
                  className="flex items-center gap-1 rounded-md border border-neutral-border px-2 py-0.5 text-[11.5px] font-semibold text-primary-900 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                >
                  {planificador.habilitado ? <Pause className="h-3 w-3" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
                  {planificador.habilitado ? 'Pausar' : 'Reanudar'}
                </button>
              )}
            </span>
          )}
        </div>
        {planificador && !planificador.habilitado && (
          <p className="mb-3 rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2 text-xs text-risk-critical">
            El planificador está pausado: no se abren horarios nuevos{planificador.motivo ? ` (${planificador.motivo})` : ''}. Los abiertos siguen y se cierran a su hora.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-3 rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2 text-xs text-risk-critical">
            {error}
          </p>
        )}

        {pestana === 'agenda' ? (
          <>
            <div className="mb-2 flex items-center gap-1.5">
              {dias.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDia(d)}
                  aria-pressed={dia === d}
                  className={[
                    'rounded-full px-3 py-1 text-[12px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
                    dia === d ? 'bg-primary-900 text-white' : 'bg-neutral-bg text-neutral-text hover:bg-primary-100',
                  ].join(' ')}
                >
                  {etiquetaDia(d, hoy)}
                </button>
              ))}
              <span className="ml-auto text-[11px] text-neutral-text-muted">Hora de Bolivia</span>
            </div>
            <div className="scrollbar-hidden max-h-[460px] overflow-y-auto rounded-lg border border-neutral-border">
              {cargando && agenda.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-text-muted">Cargando…</p>
              ) : delDia.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center text-[12.5px] text-neutral-text-muted">
                  <CalendarClock className="mb-2 h-6 w-6 text-primary-700" aria-hidden="true" />
                  No hay horarios programados para {etiquetaDia(dia, hoy).toLowerCase()}.
                  {puedeCrear && (
                    <button type="button" onClick={() => { setPestana('programaciones'); setEditor({ programacion: null }); }} className="mt-2 font-semibold text-primary-800 hover:underline">
                      Programar una ruta o un punto fijo
                    </button>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-neutral-bg">{delDia.map(filaHorario)}</ul>
              )}
            </div>
            <p className="mt-2 text-[11px] text-neutral-text-muted">
              Toca un horario para ver toda su información. Cada horario se abre 15 min antes; los automáticos asignan solos y los manuales esperan a que asignes. Los horarios sin guardias no aparecen en el mapa en vivo.
            </p>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="flex min-h-0 flex-col">
              {puedeCrear && (
                <div className="mb-2 flex justify-end">
                  <Button type="button" variant="brand" onClick={() => { setErrorEditor(null); setEditor({ programacion: null }); }}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Nueva programación
                  </Button>
                </div>
              )}
              <div className="scrollbar-hidden max-h-[460px] overflow-y-auto rounded-lg border border-neutral-border">
                {listaProgramaciones.length === 0 ? (
                  <p className="py-8 text-center text-sm text-neutral-text-muted">{cargando ? 'Cargando…' : 'Todavía no hay rutas ni puntos programados.'}</p>
                ) : (
                  <ul className="divide-y divide-neutral-bg">
                    {listaProgramaciones.map((p) => {
                      const editable = puedeProgramar && puedeEditarEn(jurisdiccion, p.epiCodigo);
                      const Icono = p.objetivo.tipo === 'punto' ? Flag : RouteIcon;
                      const elegida = editor ? editor.programacion?.id === p.id : seleccionId === p.id;
                      return (
                        <li
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={elegida}
                          onClick={() => {
                            setEditor(null);
                            setSeleccionId(p.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                            e.preventDefault();
                            setEditor(null);
                            setSeleccionId(p.id);
                          }}
                          className={[
                            'flex cursor-pointer items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-neutral-bg/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-600',
                            p.estado === 'pausada' ? 'opacity-60' : '',
                            elegida ? 'bg-neutral-bg' : '',
                          ].join(' ')}
                        >
                          <Icono className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-neutral-text">
                              <span className="truncate">{p.nombre}</span>
                              {p.estado === 'pausada' && <span className="rounded bg-neutral-bg px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-neutral-text-muted">Pausada</span>}
                              {!p.objetivo.activo && <span className="rounded bg-risk-critical/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-risk-critical">{p.objetivo.tipo === 'punto' ? 'Punto desactivado' : 'Ruta archivada'}</span>}
                            </p>
                            <ul className="text-[11.5px] text-neutral-text-muted">
                              {p.ventanas.map((v) => (
                                <li key={v.id}>
                                  {diasTexto(v.dias)} · {rangoVentana(v)} · {v.cupo} guardia(s)
                                </li>
                              ))}
                            </ul>
                            <p className="text-[11px] text-neutral-text-muted">
                              {p.modo === 'automatica' ? 'Asignación automática' : 'Asignación manual'}
                            </p>
                            <p className="text-[11px] text-neutral-text-muted">
                              {!jurisdiccion?.restringido && p.epiCodigo ? <><EpiNombre codigo={p.epiCodigo} /> · </> : null}
                              {p.proximo
                                ? new Date(p.proximo.inicio).getTime() <= Date.now()
                                  ? `En curso hasta las ${horaLocal(p.proximo.fin)}`
                                  : `Próximo: ${etiquetaDia(diaLocal(new Date(p.proximo.inicio)), hoy)} ${horaLocal(p.proximo.inicio)}`
                                : p.estado === 'activa'
                                  ? 'Sin horarios en los próximos días'
                                  : 'Pausada: no abre horarios'}
                            </p>
                          </div>
                          {editable && (
                            <span className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={() => { setErrorEditor(null); setEditor({ programacion: p }); }} aria-label={`Editar ${p.nombre}`} title="Editar" className="rounded p-1.5 text-neutral-text-muted hover:bg-neutral-bg hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600">
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                              <button type="button" onClick={() => void cambiarEstado(p)} aria-label={`${p.estado === 'activa' ? 'Pausar' : 'Reanudar'} ${p.nombre}`} title={p.estado === 'activa' ? 'Pausar' : 'Reanudar'} className="rounded p-1.5 text-neutral-text-muted hover:bg-neutral-bg hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600">
                                {p.estado === 'activa' ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
                              </button>
                              <button type="button" onClick={() => void eliminar(p)} aria-label={`Eliminar ${p.nombre}`} title="Eliminar" className="rounded p-1.5 text-neutral-text-muted hover:bg-risk-critical/10 hover:text-risk-critical focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600">
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            <div>
              {editor ? (
                <ProgramacionEditor
                  key={editor.programacion?.id ?? 'nueva'}
                  programacion={editor.programacion}
                  rutas={rutas}
                  puntos={puntos}
                  jurisdiccion={jurisdiccion}
                  guardando={guardando}
                  error={errorEditor}
                  onCancelar={() => setEditor(null)}
                  onGuardar={(b) => void guardarProgramacion(b)}
                />
              ) : fichaElegida ? (
                fichaProgramacion(fichaElegida)
              ) : (
                <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-border p-6 text-center text-[12.5px] text-neutral-text-muted">
                  <CalendarClock className="mb-2 h-6 w-6 text-primary-700" aria-hidden="true" />
                  {puedeCrear ? (
                    <>
                      Programa una ruta guardada o un punto fijo con sus días y horarios. El sistema abrirá la tarea 15 min antes de cada horario para que asignes a los guardias.
                    </>
                  ) : (
                    'Aquí ves las programaciones de tu EPI. Solo el Operador y el Super Administrador pueden crearlas o cambiarlas.'
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
