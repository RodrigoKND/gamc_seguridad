'use client';

import { useEffect, useMemo, useState } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import { Archive, Pencil, Route as RouteIcon, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useDialog } from '@/components/ui/AlertDialog';
import { EpiNombre } from '@/lib/epis/EpiNombre';
import { useEpiCatalogo } from '@/lib/epis/EpiCatalogProvider';
import {
  PATRULLA_MODALIDAD_CAPACIDAD,
  PATRULLA_MODALIDAD_LABELS,
  PATRULLA_MODALIDADES,
  TIPO_RUTA_LABELS,
  type PatrullaModalidad,
  type RutaPlantillaRow,
} from '@/types/patrulla';
import { puedeEditarEn, type Jurisdiccion } from '../../lib/jurisdiccion';
import type { LatLng } from '../../lib/routeGeometry';
import { MODALIDAD_ICONS, trazadoAPuntos } from '../../lib/rutaIconos';
import { archiveRouteAction, updateRouteAction } from '../../actions/rutasBiblioteca';
import { MapCanvas } from '../MapCanvas';

// Menú "Rutas" → "Rutas Guardadas": la biblioteca. Muestra las rutas
// PREDETERMINADAS (oficiales) primero y luego las RECURRENTES que el
// operador decidió guardar. Desde acá se ven en el mapa, se asignan, se
// editan (nombre, modalidad, tipo) y se archivan. Lo editado aplica a las
// próximas asignaciones; las que están en curso no cambian (tienen su propia
// copia de la ruta). Sin duración ni capacidad propias (F5): el horario se
// programa y el máximo de guardias es el de la modalidad.

type Filtro = 'todas' | 'establecida' | 'guardada';

interface Edicion {
  nombre: string;
  descripcion: string;
  tipo: 'establecida' | 'guardada';
  modalidad: PatrullaModalidad;
}

function Encuadrar({ path }: { path: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (path.length >= 2) map.fitBounds(path.map((p) => [p.lat, p.lng]) as [number, number][], { padding: [24, 24], maxZoom: 16, animate: false });
  }, [map, path]);
  return null;
}

export interface RutasGuardadasModalProps {
  isOpen: boolean;
  onClose: () => void;
  rutas: RutaPlantillaRow[];
  jurisdiccion: Jurisdiccion | null;
  /** Permisos de la sesión (el backend los vuelve a validar). */
  puedeAsignar: boolean;
  puedeGestionarRecurrentes: boolean;
  puedeGestionarPredeterminadas: boolean;
  puedeArchivarPredeterminadas: boolean;
  onAsignar: (ruta: RutaPlantillaRow) => void;
  /** Recarga la biblioteca tras editar o archivar. */
  onCambio: () => void;
}

export function RutasGuardadasModal({
  isOpen,
  onClose,
  rutas: todas,
  jurisdiccion,
  puedeAsignar,
  puedeGestionarRecurrentes,
  puedeGestionarPredeterminadas,
  puedeArchivarPredeterminadas,
  onAsignar,
  onCambio,
}: RutasGuardadasModalProps) {
  const dialogo = useDialog();
  const { operativas: epis } = useEpiCatalogo();
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [epiFiltro, setEpiFiltro] = useState('');
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFiltro('todas');
    setBusqueda('');
    setEpiFiltro('');
    setSeleccionId(null);
    setEdicion(null);
  }, [isOpen]);

  // Un Operador/Admin ve solo las de su EPI; el Super Admin, todas (con filtro por EPI).
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return todas
      .filter((r) => puedeEditarEn(jurisdiccion, r.epiId))
      .filter((r) => r.tipo === 'establecida' || r.tipo === 'guardada')
      .filter((r) => filtro === 'todas' || r.tipo === filtro)
      .filter((r) => !epiFiltro || r.epiId === epiFiltro)
      .filter((r) => !q || r.nombre.toLowerCase().includes(q) || (r.descripcion ?? '').toLowerCase().includes(q))
      .sort((a, b) => Number(b.tipo === 'establecida') - Number(a.tipo === 'establecida') || a.nombre.localeCompare(b.nombre));
  }, [todas, jurisdiccion, filtro, epiFiltro, busqueda]);
  const predeterminadas = visibles.filter((r) => r.tipo === 'establecida');
  const recurrentes = visibles.filter((r) => r.tipo === 'guardada');
  const seleccion = visibles.find((r) => r.id === seleccionId) ?? visibles[0] ?? null;
  const path = useMemo(() => (seleccion ? trazadoAPuntos(seleccion.trazado) : []), [seleccion]);

  const esPredeterminada = seleccion?.tipo === 'establecida';
  const puedeEditar = esPredeterminada ? puedeGestionarPredeterminadas : puedeGestionarRecurrentes;
  const puedeArchivar = esPredeterminada ? puedeArchivarPredeterminadas : puedeGestionarRecurrentes;
  // Cambiar el tipo exige poder gestionar ambos tipos.
  const puedeCambiarTipo = puedeGestionarPredeterminadas && puedeGestionarRecurrentes;

  function abrirEdicion(r: RutaPlantillaRow) {
    setEdicion({
      nombre: r.nombre,
      descripcion: r.descripcion ?? '',
      tipo: r.tipo === 'establecida' ? 'establecida' : 'guardada',
      modalidad: r.modalidad ?? 'coche',
    });
  }

  const edicionValida = Boolean(edicion?.nombre.trim());

  async function guardarEdicion() {
    if (!seleccion || !edicion || !edicionValida) return;
    setGuardando(true);
    const r = await updateRouteAction(seleccion.id, {
      nombre: edicion.nombre.trim(),
      descripcion: edicion.descripcion.trim() || null,
      tipo: edicion.tipo,
      modalidad: edicion.modalidad,
    });
    setGuardando(false);
    if (!r.success) {
      await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo guardar', mensaje: r.error ?? 'Intenta nuevamente.' });
      return;
    }
    setEdicion(null);
    onCambio();
  }

  async function archivar(r: RutaPlantillaRow) {
    const ok = await dialogo.confirmar({
      tono: 'peligro',
      titulo: `¿Archivar «${r.nombre}»?`,
      mensaje: 'Dejará de aparecer en «Rutas Guardadas» y en «Asignar Ruta». Las asignaciones que están en curso con esta ruta siguen igual.',
      textoConfirmar: 'Archivar',
      destructivo: true,
    });
    if (!ok) return;
    const res = await archiveRouteAction(r.id);
    if (!res.success) {
      await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo archivar', mensaje: res.error ?? 'Intenta nuevamente.' });
      return;
    }
    setSeleccionId(null);
    onCambio();
  }

  function filaRuta(r: RutaPlantillaRow) {
    const Icon = MODALIDAD_ICONS[r.modalidad ?? 'coche'];
    const activa = seleccion?.id === r.id;
    return (
      <li key={r.id}>
        <button
          type="button"
          onClick={() => {
            setSeleccionId(r.id);
            setEdicion(null);
          }}
          className={[
            'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
            activa ? 'bg-accent-100/60' : 'hover:bg-neutral-bg',
          ].join(' ')}
        >
          <Icon className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-neutral-text">{r.nombre}</p>
            <p className="truncate text-[11px] text-neutral-text-muted">
              <EpiNombre codigo={r.epiId} /> · {PATRULLA_MODALIDAD_LABELS[r.modalidad ?? 'coche']}
            </p>
          </div>
        </button>
      </li>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rutas Guardadas" widthClassName="max-w-[920px]" accent="gold">
      <div className="flex flex-col gap-4 p-5 md:flex-row">
        {/* Lista */}
        <div className="flex min-w-0 flex-col md:w-[320px] md:shrink-0">
          <div className="mb-2 flex gap-1">
            {(['todas', 'establecida', 'guardada'] as Filtro[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltro(f)}
                className={[
                  'rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                  filtro === f ? 'bg-primary-900 text-white' : 'bg-neutral-bg text-neutral-text hover:bg-primary-100',
                ].join(' ')}
              >
                {f === 'todas' ? 'Todas' : f === 'establecida' ? 'Predeterminadas' : 'Recurrentes'}
              </button>
            ))}
          </div>
          <div className="mb-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-text-muted" aria-hidden="true" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar…"
                aria-label="Buscar ruta"
                className="h-9 w-full rounded-md border border-neutral-border pl-8 pr-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              />
            </div>
            {jurisdiccion && !jurisdiccion.restringido && (
              <select
                value={epiFiltro}
                onChange={(e) => setEpiFiltro(e.target.value)}
                aria-label="Filtrar por EPI"
                className="h-9 max-w-[130px] rounded-md border border-neutral-border bg-white px-2 text-[12px]"
              >
                <option value="">Todas las EPIs</option>
                {epis.map((e) => (
                  <option key={e.codigo} value={e.codigo}>
                    {e.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="scrollbar-hidden max-h-[440px] overflow-y-auto">
            {visibles.length === 0 ? (
              <p className="py-8 text-center text-[12.5px] text-neutral-text-muted">No hay rutas guardadas{busqueda || epiFiltro || filtro !== 'todas' ? ' con ese filtro' : ''}.</p>
            ) : (
              <>
                {predeterminadas.length > 0 && (
                  <>
                    <p className="px-1 pb-1 pt-1 text-[10.5px] font-bold uppercase tracking-wide text-neutral-text-muted">Predeterminadas · {predeterminadas.length}</p>
                    <ul className="mb-2 space-y-0.5">{predeterminadas.map(filaRuta)}</ul>
                  </>
                )}
                {recurrentes.length > 0 && (
                  <>
                    <p className="px-1 pb-1 pt-1 text-[10.5px] font-bold uppercase tracking-wide text-neutral-text-muted">Recurrentes · {recurrentes.length}</p>
                    <ul className="space-y-0.5">{recurrentes.map(filaRuta)}</ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detalle */}
        <div className="min-w-0 flex-1">
          {!seleccion ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-border text-neutral-text-muted">
              <RouteIcon className="h-6 w-6" aria-hidden="true" />
              <p className="text-[12.5px]">Elige una ruta para verla.</p>
            </div>
          ) : (
            <div>
              <div className="relative mb-3 h-[240px] overflow-hidden rounded-lg border border-neutral-border">
                <MapCanvas key={seleccion.id}>
                  {path.length >= 2 && <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#A97F52', weight: 4, opacity: 0.9 }} />}
                  <Encuadrar path={path} />
                </MapCanvas>
              </div>

              {edicion ? (
                <div className="rounded-lg border border-primary-200 bg-primary-50/40 p-3">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <Input label="Nombre" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} disabled={guardando} />
                    <Input label="Descripción" value={edicion.descripcion} onChange={(e) => setEdicion({ ...edicion, descripcion: e.target.value })} disabled={guardando} />
                    <Select label="Modalidad" value={edicion.modalidad} onChange={(e) => setEdicion({ ...edicion, modalidad: e.target.value as PatrullaModalidad })} disabled={guardando}>
                      {PATRULLA_MODALIDADES.map((m) => (
                        <option key={m} value={m}>
                          {PATRULLA_MODALIDAD_LABELS[m]}
                        </option>
                      ))}
                    </Select>
                    {puedeCambiarTipo ? (
                      <Select label="Tipo" value={edicion.tipo} onChange={(e) => setEdicion({ ...edicion, tipo: e.target.value as Edicion['tipo'] })} disabled={guardando}>
                        <option value="establecida">{TIPO_RUTA_LABELS.establecida}</option>
                        <option value="guardada">{TIPO_RUTA_LABELS.guardada}</option>
                      </Select>
                    ) : (
                      <div />
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-neutral-text-muted">Los cambios aplican a las próximas asignaciones; las que están en curso no se modifican.</p>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => setEdicion(null)} disabled={guardando} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="button" variant="brand" onClick={guardarEdicion} isLoading={guardando} disabled={!edicionValida} className="flex-1">
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-1 flex items-center gap-2">
                    <p className="min-w-0 truncate text-[15px] font-semibold text-primary-900">{seleccion.nombre}</p>
                    <span
                      className={[
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                        esPredeterminada ? 'bg-primary-100 text-primary-800' : 'bg-neutral-bg text-neutral-text',
                      ].join(' ')}
                    >
                      {esPredeterminada ? TIPO_RUTA_LABELS.establecida : TIPO_RUTA_LABELS.guardada}
                    </span>
                  </div>
                  {seleccion.descripcion && <p className="mb-2 text-[12px] text-neutral-text-muted">{seleccion.descripcion}</p>}
                  <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-3">
                    <div>
                      <dt className="text-neutral-text-muted">EPI</dt>
                      <dd className="font-medium text-neutral-text"><EpiNombre codigo={seleccion.epiId} /></dd>
                    </div>
                    <div>
                      <dt className="text-neutral-text-muted">Modalidad</dt>
                      <dd className="font-medium text-neutral-text">{PATRULLA_MODALIDAD_LABELS[seleccion.modalidad ?? 'coche']}</dd>
                    </div>
                    <div>
                      <dt className="text-neutral-text-muted">Capacidad</dt>
                      <dd className="font-medium text-neutral-text">Hasta {PATRULLA_MODALIDAD_CAPACIDAD[seleccion.modalidad ?? 'coche']} guardia(s)</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {puedeAsignar && (
                      <Button type="button" variant="brand" onClick={() => onAsignar(seleccion)} className="flex-1">
                        <RouteIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        Asignar
                      </Button>
                    )}
                    {puedeEditar && (
                      <Button type="button" variant="secondary" onClick={() => abrirEdicion(seleccion)} className="flex-1">
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Editar
                      </Button>
                    )}
                    {puedeArchivar && (
                      <Button type="button" variant="secondary" onClick={() => archivar(seleccion)} className="!text-risk-critical">
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                        Archivar
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
