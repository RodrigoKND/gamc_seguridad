'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PATRULLA_MODALIDAD_CAPACIDAD, PATRULLA_MODALIDAD_LABELS, TIPO_RUTA_LABELS, type RutaPlantillaRow } from '@/types/patrulla';
import type { PuntoFijoRow } from '@/types/puntoFijo';
import { DIAS_SEMANA, type ModoAsignacion, type ProgramacionBody, type ProgramacionRow } from '@/types/programacion';
import { puedeEditarEn, type Jurisdiccion } from '../../lib/jurisdiccion';
import { duracionEntre, horaMas } from '../../lib/programacionTexto';

// Editor de una programación (F5): qué se cubre (ruta de la biblioteca o
// punto fijo) y sus horarios. Cada horario: días, hora de inicio y de fin
// (si el fin es menor o igual, termina al día siguiente; igual = 24 h) y
// cuántos guardias necesita (hasta el máximo de la modalidad o del punto).
// Sin fechas: funciona desde que se guarda hasta que se pausa o se elimina.
// El backend vuelve a validar todo, también que no se cruce con otro horario
// del mismo punto o ruta.
//
// F6: interruptor «Asignación automática»: apagado, el operador asigna; encendido,
// el sistema elige solo a los guardias libres más cercanos (busca a 3 km y
// amplía 2 km cada 3 min sin nadie; el radio no se configura).
//
// Editar vale para los horarios FUTUROS: el que ya está abierto conserva lo
// que tenía. Cambiar días u horas de un horario lo reemplaza por uno nuevo.

interface FilaHorario {
  /** Horario existente (al editar). */
  id?: string;
  dias: number[];
  inicio: string;
  fin: string;
  cupo: string;
}

const L_V = [1, 2, 3, 4, 5];
const TODOS = [1, 2, 3, 4, 5, 6, 7];

export interface ProgramacionEditorProps {
  /** null = nueva. */
  programacion: ProgramacionRow | null;
  rutas: RutaPlantillaRow[];
  puntos: PuntoFijoRow[];
  jurisdiccion: Jurisdiccion | null;
  guardando: boolean;
  error: string | null;
  onCancelar: () => void;
  onGuardar: (body: ProgramacionBody) => void;
}

export function ProgramacionEditor({ programacion, rutas, puntos, jurisdiccion, guardando, error, onCancelar, onGuardar }: ProgramacionEditorProps) {
  const editando = Boolean(programacion);
  // Solo lo de MI EPI (el backend repite la jurisdicción). Rutas dinámicas no se programan.
  const rutasMias = useMemo(
    () => rutas.filter((r) => (r.tipo === 'establecida' || r.tipo === 'guardada') && puedeEditarEn(jurisdiccion, r.epiId)).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [rutas, jurisdiccion],
  );
  const puntosMios = useMemo(() => puntos.filter((p) => p.activo && puedeEditarEn(jurisdiccion, p.epiCodigo)), [puntos, jurisdiccion]);

  const [tipo, setTipo] = useState<'ruta' | 'punto'>(programacion?.objetivo.tipo ?? 'punto');
  const [objetivoId, setObjetivoId] = useState(programacion?.objetivo.id ?? '');
  const [nombre, setNombre] = useState(programacion?.nombre ?? '');
  const [modo, setModo] = useState<ModoAsignacion>(programacion?.modo ?? 'manual');
  const [filas, setFilas] = useState<FilaHorario[]>(
    programacion
      ? programacion.ventanas.map((v) => ({ id: v.id, dias: v.dias, inicio: v.horaInicio, fin: v.horaFin, cupo: String(v.cupo) }))
      : [{ dias: TODOS, inicio: '06:30', fin: '14:30', cupo: '2' }],
  );

  const ruta = tipo === 'ruta' ? rutasMias.find((r) => r.id === objetivoId) : undefined;
  const punto = tipo === 'punto' ? puntosMios.find((p) => p.id === objetivoId) : undefined;
  // Máximo de guardias por horario: el de la programación (al editar) o el de la ruta/punto elegido.
  const cupoMax =
    programacion?.cupoMax ??
    (punto ? punto.capacidad : ruta ? PATRULLA_MODALIDAD_CAPACIDAD[ruta.modalidad ?? 'coche'] : 0);

  const problemas = filas.map((f) => {
    if (f.dias.length === 0) return 'Elige al menos un día.';
    if (!/^\d{2}:\d{2}$/.test(f.inicio) || !/^\d{2}:\d{2}$/.test(f.fin)) return 'Indica la hora de inicio y de fin.';
    const c = Number(f.cupo);
    if (!Number.isInteger(c) || c < 1) return 'Indica cuántos guardias.';
    if (cupoMax && c > cupoMax) return `Máximo ${cupoMax} guardia(s).`;
    if (duracionEntre(f.inicio, f.fin) < 15) return 'Dura al menos 15 minutos.';
    return null;
  });
  const valido = Boolean(objetivoId) && filas.length > 0 && problemas.every((p) => p === null);

  function cambiarFila(i: number, cambio: Partial<FilaHorario>) {
    setFilas((fs) => fs.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  }

  function alternarDia(i: number, d: number) {
    const f = filas[i]!;
    cambiarFila(i, { dias: f.dias.includes(d) ? f.dias.filter((x) => x !== d) : [...f.dias, d].sort() });
  }

  function guardar() {
    if (!valido) return;
    const ventanas = filas.map((f) => ({
      ...(f.id ? { id: f.id } : {}),
      dias: f.dias,
      horaInicio: f.inicio,
      duracionMin: duracionEntre(f.inicio, f.fin),
      cupo: Number(f.cupo),
    }));
    const asignacion = { modo };
    const base = { nombre: nombre.trim() || null, ventanas, ...asignacion };
    onGuardar(editando ? { ...base, nombre: nombre.trim() || programacion!.nombre } : { ...base, ...(tipo === 'ruta' ? { rutaPlantillaId: objetivoId } : { puntoFijoId: objetivoId }) });
  }

  return (
    <div className="flex flex-col">
      <p className="mb-3 text-[13px] font-semibold text-primary-900">{editando ? `Editar «${programacion!.nombre}»` : 'Nueva programación'}</p>

      {editando ? (
        <p className="mb-3 rounded-lg bg-neutral-bg px-3 py-2 text-[12px] text-neutral-text">
          {programacion!.objetivo.tipo === 'punto' ? 'Punto fijo' : 'Ruta'}: <strong>{programacion!.objetivo.nombre}</strong> · hasta {programacion!.cupoMax} guardia(s) por horario
        </p>
      ) : (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-[150px_minmax(0,1fr)]">
          <Select
            label="Qué se cubre"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as 'ruta' | 'punto');
              setObjetivoId('');
            }}
            disabled={guardando}
            accent="gold"
          >
            <option value="punto">Punto fijo</option>
            <option value="ruta">Ruta guardada</option>
          </Select>
          <Select
            label={tipo === 'punto' ? 'Punto fijo' : 'Ruta (predeterminada o recurrente)'}
            value={objetivoId}
            onChange={(e) => {
              setObjetivoId(e.target.value);
              const elegido = tipo === 'punto' ? puntosMios.find((p) => p.id === e.target.value) : rutasMias.find((r) => r.id === e.target.value);
              if (elegido && !nombre.trim()) setNombre(elegido.nombre);
            }}
            disabled={guardando}
            accent="gold"
          >
            <option value="">Elegir…</option>
            {tipo === 'punto'
              ? puntosMios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} — capacidad {p.capacidad}
                  </option>
                ))
              : rutasMias.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre} — {TIPO_RUTA_LABELS[r.tipo ?? 'guardada']}, {PATRULLA_MODALIDAD_LABELS[r.modalidad ?? 'coche']}
                  </option>
                ))}
          </Select>
        </div>
      )}
      {!editando && tipo === 'ruta' && rutasMias.length === 0 && (
        <p className="-mt-1 mb-3 text-[11.5px] text-neutral-text-muted">No hay rutas guardadas en tu EPI. Créalas en «Crear Ruta» o guarda una al asignar.</p>
      )}

      <div className="mb-3">
        <Input label="Nombre en la agenda" value={nombre} placeholder={ruta?.nombre ?? punto?.nombre ?? ''} onChange={(e) => setNombre(e.target.value)} disabled={guardando} accent="gold" />
      </div>

      <div className="mb-3 rounded-lg border border-neutral-border p-2.5">
        <div className="flex flex-wrap items-end gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={modo === 'automatica'}
            aria-label="Asignación automática"
            onClick={() => setModo(modo === 'automatica' ? 'manual' : 'automatica')}
            disabled={guardando}
            className="flex items-center gap-2.5 rounded-lg py-1.5 pr-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className={[
                'flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 motion-reduce:transition-none',
                modo === 'automatica' ? 'bg-primary-700' : 'bg-neutral-border',
              ].join(' ')}
            >
              <span
                className={[
                  'h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 motion-reduce:transition-none',
                  modo === 'automatica' ? 'translate-x-5' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
            <span className="text-[12.5px] font-semibold text-neutral-text">Asignación automática</span>
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-neutral-text-muted">
          {modo === 'automatica'
            ? 'Al abrirse cada horario (15 min antes) el sistema asigna solo a los guardias libres más cercanos: en servicio, sin SOS, sin otra ruta, con GPS de menos de 10 min y batería de al menos 15 %. Busca a 3 km y, si en 3 min no encuentra a nadie, amplía la búsqueda 2 km. Si retiras a un guardia, busca su reemplazo o lo eliges tú en ese momento.'
            : 'Cada horario se abre 15 min antes y avisa en la campana para que asignes a los guardias.'}
        </p>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-neutral-text">Horarios {cupoMax ? <span className="font-normal text-neutral-text-muted">· hasta {cupoMax} guardia(s) cada uno</span> : null}</p>
        <button
          type="button"
          onClick={() => setFilas((fs) => [...fs, { dias: TODOS, inicio: fs.at(-1)?.fin ?? '06:00', fin: horaMas(fs.at(-1)?.fin ?? '06:00', 480), cupo: fs.at(-1)?.cupo ?? '1' }])}
          disabled={guardando || filas.length >= 14}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-semibold text-primary-800 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Agregar horario
        </button>
      </div>
      <ul className="mb-3 space-y-2">
        {filas.map((f, i) => {
          const dur = duracionEntre(f.inicio, f.fin);
          return (
            <li key={f.id ?? `n${i}`} className="rounded-lg border border-neutral-border p-2.5">
              <div className="mb-2 flex flex-wrap items-center gap-1" role="group" aria-label={`Días del horario ${i + 1}`}>
                {DIAS_SEMANA.map((d) => {
                  const activo = f.dias.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => alternarDia(i, d.id)}
                      aria-pressed={activo}
                      title={d.largo}
                      disabled={guardando}
                      className={[
                        'h-7 w-7 rounded-full text-[11.5px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
                        activo ? 'bg-primary-900 text-white' : 'bg-neutral-bg text-neutral-text-muted hover:bg-primary-100',
                      ].join(' ')}
                    >
                      {d.corto}
                    </button>
                  );
                })}
                <span className="ml-1 flex gap-1">
                  <button type="button" onClick={() => cambiarFila(i, { dias: L_V })} disabled={guardando} className="rounded px-1.5 py-0.5 text-[11px] text-primary-800 hover:bg-neutral-bg">
                    L–V
                  </button>
                  <button type="button" onClick={() => cambiarFila(i, { dias: TODOS })} disabled={guardando} className="rounded px-1.5 py-0.5 text-[11px] text-primary-800 hover:bg-neutral-bg">
                    Todos
                  </button>
                </span>
                {filas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setFilas((fs) => fs.filter((_, j) => j !== i))}
                    disabled={guardando}
                    aria-label={`Quitar horario ${i + 1}`}
                    title="Quitar horario"
                    className="ml-auto rounded p-1.5 text-neutral-text-muted hover:bg-risk-critical/10 hover:text-risk-critical focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input label="Desde" type="time" value={f.inicio} onChange={(e) => cambiarFila(i, { inicio: e.target.value })} disabled={guardando} accent="gold" />
                <Input
                  label="Hasta"
                  type="time"
                  value={f.fin}
                  onChange={(e) => cambiarFila(i, { fin: e.target.value })}
                  helperText={dur === 1440 ? '24 horas' : dur + Number(f.inicio.slice(0, 2)) * 60 + Number(f.inicio.slice(3, 5)) > 1440 ? 'Termina al día siguiente' : undefined}
                  disabled={guardando}
                  accent="gold"
                />
                <Input label="Guardias" type="number" min={1} max={cupoMax || 50} value={f.cupo} onChange={(e) => cambiarFila(i, { cupo: e.target.value })} disabled={guardando} accent="gold" />
              </div>
              {problemas[i] && <p className="mt-1.5 text-[11.5px] text-risk-critical">{problemas[i]}</p>}
            </li>
          );
        })}
      </ul>
      <p className="mb-3 text-[11px] text-neutral-text-muted">
        La tarea de cada horario aparece 15 min antes de su inicio para asignar a los guardias. Un turno que pasa la medianoche pertenece al día en que empieza.
        {editando ? ' Los cambios valen para los horarios que todavía no se abrieron.' : ''}
      </p>

      {error && (
        <div role="alert" className="mb-3 rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2 text-xs text-risk-critical">
          {error}
        </div>
      )}
      <div className="flex gap-2.5">
        <Button type="button" variant="secondary" onClick={onCancelar} disabled={guardando} className="flex-1">
          Cancelar
        </Button>
        <Button type="button" variant="brand" onClick={guardar} isLoading={guardando} disabled={!valido} className="flex-1">
          Guardar
        </Button>
      </div>
    </div>
  );
}
