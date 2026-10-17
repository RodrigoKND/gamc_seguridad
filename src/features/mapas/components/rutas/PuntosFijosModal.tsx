'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Flag, Pencil, Plus, Power, Search, Users } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useDialog, type DialogDetalle } from '@/components/ui/AlertDialog';
import { useEpiCatalogo } from '@/lib/epis/EpiCatalogProvider';
import { getPuntosFijos } from '@/lib/data-source';
import { libresDe, type OcupanteAfectado, type PoliticaOcupados, type PuntoFijoRow } from '@/types/puntoFijo';
import { puedeEditarEn, puntoPermitido, type Jurisdiccion } from '../../lib/jurisdiccion';
import type { LatLng } from '../../lib/routeGeometry';
import { createPuntoFijoAction, updatePuntoFijoAction, type PuntoFijoResult } from '../../actions/puntosFijos';
import { EpiJurisdictionLayer } from '../EpiJurisdictionLayer';
import { MapCanvas } from '../MapCanvas';
import { MapSearch } from '../MapSearch';

// Menú "Rutas" → "Puntos Fijos" (F4): catálogo de lugares establecidos
// con su capacidad y subpuntos. Lo administran el Operador (en su EPI) y el
// Super Admin; el backend valida permiso, jurisdicción y ocupación.
//
// Lo ocupado nunca cambia en silencio: mover un punto con guardias pide
// elegir si se trasladan a la nueva ubicación o se retiran; desactivarlo
// pide confirmar el retiro (la lista de guardias sale en la ventana).

const DISTANCIA_MAX_SUBPUNTO_M = 1500;

interface Formulario {
  modo: 'crear' | 'editar';
  /** Editar: el punto. Crear subpunto: su padre. */
  punto: PuntoFijoRow | null;
  padre: PuntoFijoRow | null;
  nombre: string;
  descripcion: string;
  capacidad: string;
  pos: LatLng | null;
  verificada: boolean;
  /** Solo Super Admin y puntos principales: '' = por ubicación. */
  epiCodigo: string;
  politica: PoliticaOcupados;
}

const pinNuevo = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#A97F52;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function CapturaClic({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function Centrar({ en }: { en: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (en) map.setView([en.lat, en.lng], Math.max(map.getZoom(), 16), { animate: false });
    // Solo al abrir el formulario de otro punto (no en cada clic).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [en?.lat, en?.lng]);
  return null;
}

function distanciaM(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function detallesOcupantes(ocupantes: { guardiaNombre: string }[]): DialogDetalle[] {
  return ocupantes.map((o) => ({ titulo: o.guardiaNombre, tono: 'advertencia' }));
}

export interface PuntosFijosModalProps {
  isOpen: boolean;
  onClose: () => void;
  jurisdiccion: Jurisdiccion | null;
  /** El Super Admin puede fijar la EPI de un punto a mano. */
  esSuperAdmin: boolean;
  /** Recarga el mapa tras un cambio. */
  onCambio: () => void;
}

export function PuntosFijosModal({ isOpen, onClose, jurisdiccion, esSuperAdmin, onCambio }: PuntosFijosModalProps) {
  const dialogo = useDialog();
  const { operativas: epis, nombre: nombreEpi } = useEpiCatalogo();
  const [puntos, setPuntos] = useState<PuntoFijoRow[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [verInactivos, setVerInactivos] = useState(false);
  const [form, setForm] = useState<Formulario | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      setPuntos(await getPuntosFijos({ incluirInactivos: true }));
    } catch {
      setError('No se pudo cargar el catálogo de puntos fijos.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setBusqueda('');
    setVerInactivos(false);
    setForm(null);
    setError(null);
    void recargar();
  }, [isOpen, recargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return puntos
      .filter((p) => verInactivos || p.activo)
      .filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.subpuntos.some((s) => s.nombre.toLowerCase().includes(q)))
      // Los de mi EPI primero; luego por EPI y nombre.
      .sort(
        (a, b) =>
          Number(puedeEditarEn(jurisdiccion, b.epiCodigo)) - Number(puedeEditarEn(jurisdiccion, a.epiCodigo)) ||
          a.epiNombre.localeCompare(b.epiNombre) ||
          a.nombre.localeCompare(b.nombre),
      );
  }, [puntos, busqueda, verInactivos, jurisdiccion]);

  function abrirCrear(padre: PuntoFijoRow | null) {
    setError(null);
    setForm({
      modo: 'crear',
      punto: null,
      padre,
      nombre: '',
      descripcion: '',
      capacidad: '2',
      pos: padre ? { lat: padre.lat, lng: padre.lng } : null,
      verificada: false,
      epiCodigo: '',
      politica: 'trasladar',
    });
  }

  function abrirEditar(p: PuntoFijoRow, padre: PuntoFijoRow | null) {
    setError(null);
    setForm({
      modo: 'editar',
      punto: p,
      padre,
      nombre: p.nombre,
      descripcion: p.descripcion ?? '',
      capacidad: String(p.capacidad),
      pos: { lat: p.lat, lng: p.lng },
      verificada: !p.coordenadasAproximadas,
      epiCodigo: p.epiMetodo === 'manual' ? p.epiCodigo : '',
      politica: 'trasladar',
    });
  }

  const conSubpuntos = Boolean(form?.punto && !form.punto.padreId && form.punto.subpuntos.some((s) => s.activo));
  const movido = Boolean(form?.punto && form.pos && (form.pos.lat !== form.punto.lat || form.pos.lng !== form.punto.lng));
  // Guardias del punto que este cambio afectaría (si es un punto con subpuntos, los suyos no se mueven).
  const ocupadosAqui = form?.punto && !conSubpuntos ? form.punto.ocupados : 0;
  const capacidad = Number(form?.capacidad);
  const capacidadValida = conSubpuntos || (Number.isInteger(capacidad) && capacidad >= 1 && capacidad <= 50);
  const lejosDelPadre = Boolean(form?.padre && form.pos && distanciaM(form.padre, form.pos) > DISTANCIA_MAX_SUBPUNTO_M);
  const formValido = Boolean(form && form.nombre.trim().length >= 2 && form.pos && capacidadValida && !lejosDelPadre);

  function alHacerClic(p: LatLng) {
    if (!form) return;
    // Un subpunto hereda la EPI de su punto: basta con estar cerca. Un punto
    // principal de un Operador debe caer dentro de su EPI (el backend lo repite).
    if (!form.padre && !(form.punto?.padreId) && !puntoPermitido(jurisdiccion, p)) {
      setError('Ese lugar está fuera de tu jurisdicción. Marca el punto dentro del área resaltada.');
      return;
    }
    setError(null);
    setForm({ ...form, pos: p });
  }

  async function reintentarConPolitica(r: PuntoFijoResult, enviar: (p: PoliticaOcupados) => Promise<PuntoFijoResult>): Promise<PuntoFijoResult> {
    if (r.success || !r.ocupantes) return r;
    // Algo cambió mientras tanto (alguien asignó guardias): se pide decidir de nuevo.
    if (!r.opciones || r.opciones.length === 0) {
      await dialogo.avisar({ tono: 'advertencia', titulo: 'No se puede aplicar el cambio', mensaje: r.error, detalles: detallesOcupantes(r.ocupantes) });
      return { success: false };
    }
    const politica: PoliticaOcupados = r.opciones.includes('trasladar') && form?.politica === 'trasladar' ? 'trasladar' : 'retirar';
    const ok = await dialogo.confirmar({
      tono: 'advertencia',
      titulo: politica === 'trasladar' ? 'Trasladar a sus guardias' : 'Retirar a sus guardias',
      mensaje: r.error,
      detalles: detallesOcupantes(r.ocupantes),
      textoConfirmar: politica === 'trasladar' ? 'Trasladar y guardar' : 'Retirar y guardar',
      destructivo: politica === 'retirar',
    });
    if (!ok) return { success: false };
    return enviar(politica);
  }

  async function guardar() {
    if (!form || !formValido || !form.pos) return;
    setGuardando(true);
    setError(null);
    let r: PuntoFijoResult;
    if (form.modo === 'crear') {
      r = await createPuntoFijoAction({
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim() || null,
        lat: form.pos.lat,
        lng: form.pos.lng,
        capacidad,
        padreId: form.padre?.id ?? null,
        coordenadasAproximadas: !form.verificada,
        ...(esSuperAdmin && !form.padre && form.epiCodigo ? { epiCodigo: form.epiCodigo } : {}),
      });
      if (!r.success && r.ocupantes) {
        await dialogo.avisar({ tono: 'advertencia', titulo: 'No se pudo crear el subpunto', mensaje: r.error, detalles: detallesOcupantes(r.ocupantes) });
        setGuardando(false);
        return;
      }
    } else {
      const p = form.punto!;
      const enviar = (politica?: PoliticaOcupados) =>
        updatePuntoFijoAction(p.id, {
          nombre: form.nombre.trim(),
          descripcion: form.descripcion.trim() || null,
          ...(movido ? { lat: form.pos!.lat, lng: form.pos!.lng } : {}),
          ...(conSubpuntos ? {} : { capacidad }),
          coordenadasAproximadas: !form.verificada,
          ...(esSuperAdmin && !p.padreId && (form.epiCodigo || p.epiMetodo === 'manual') ? { epiCodigo: form.epiCodigo || null } : {}),
          ...(politica ? { politicaOcupados: politica } : {}),
        });
      r = await enviar(movido && ocupadosAqui > 0 ? form.politica : undefined);
      r = await reintentarConPolitica(r, (pol) => enviar(pol));
    }
    setGuardando(false);
    if (!r.success) {
      if (r.error) setError(r.error);
      return;
    }
    setForm(null);
    await recargar();
    onCambio();
  }

  async function cambiarActivo(p: PuntoFijoRow, padre: PuntoFijoRow | null) {
    const nombreCompleto = padre ? `${padre.nombre} · ${p.nombre}` : p.nombre;
    if (p.activo) {
      const ocupantes = [...(p.ocupantes ?? []), ...p.subpuntos.flatMap((s) => s.ocupantes ?? [])];
      const ok = await dialogo.confirmar({
        tono: ocupantes.length > 0 ? 'peligro' : 'advertencia',
        titulo: `¿Desactivar «${nombreCompleto}»?`,
        mensaje:
          ocupantes.length > 0
            ? `Tiene ${ocupantes.length} guardia(s) asignado(s): saldrán del punto (queda registrado en su historial).`
            : `Dejará de aparecer en el mapa y en «Asignar Ruta».${!padre && p.subpuntos.length > 0 ? ' Sus subpuntos también se desactivan.' : ''}`,
        detalles: detallesOcupantes(ocupantes),
        textoConfirmar: ocupantes.length > 0 ? 'Retirar y desactivar' : 'Desactivar',
        destructivo: true,
      });
      if (!ok) return;
      let r = await updatePuntoFijoAction(p.id, { activo: false, ...(ocupantes.length > 0 ? { politicaOcupados: 'retirar' } : {}) });
      r = await reintentarConPolitica(r, (pol) => updatePuntoFijoAction(p.id, { activo: false, politicaOcupados: pol }));
      if (!r.success) {
        if (r.error) await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo desactivar', mensaje: r.error });
        return;
      }
    } else {
      const r = await updatePuntoFijoAction(p.id, { activo: true });
      if (!r.success) {
        await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo reactivar', mensaje: r.error, detalles: r.ocupantes ? detallesOcupantes(r.ocupantes as OcupanteAfectado[]) : undefined });
        return;
      }
    }
    await recargar();
    onCambio();
  }

  function fila(p: PuntoFijoRow, padre: PuntoFijoRow | null) {
    const editable = puedeEditarEn(jurisdiccion, padre?.epiCodigo ?? p.epiCodigo);
    const libres = libresDe(p);
    return (
      <div className={['flex items-center gap-2.5 rounded-lg px-2.5 py-2', padre ? 'ml-6' : '', p.activo ? '' : 'opacity-55'].join(' ')}>
        <Flag className={['h-4 w-4 shrink-0', padre ? 'text-neutral-text-muted' : 'text-primary-700'].join(' ')} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-neutral-text">
            <span className="truncate">{p.nombre}</span>
            {!p.activo && <span className="rounded bg-neutral-bg px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-neutral-text-muted">Desactivado</span>}
            {p.coordenadasAproximadas && <span className="rounded bg-risk-medium/15 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-[#B45309]">Aproximada</span>}
            {p.epiMetodo === 'manual' && <span className="rounded bg-primary-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-primary-800">EPI manual</span>}
          </p>
          <p className="truncate text-[11px] text-neutral-text-muted">
            {padre ? 'Subpunto' : p.epiNombre} · {p.ocupados}/{p.capacidad} {libres === 0 ? '(completo)' : ''}
            {p.ocupantes && p.ocupantes.length > 0 ? ` — ${p.ocupantes.map((o) => o.guardiaNombre).join(', ')}` : ''}
          </p>
        </div>
        {editable && (
          <span className="flex shrink-0 items-center gap-0.5">
            {p.activo && (
              <button type="button" onClick={() => abrirEditar(p, padre)} aria-label={`Editar ${p.nombre}`} title="Editar" className="rounded p-1.5 text-neutral-text-muted hover:bg-neutral-bg hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600">
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {!padre && p.activo && (
              <button type="button" onClick={() => abrirCrear(p)} aria-label={`Agregar subpunto a ${p.nombre}`} title="Agregar subpunto" className="rounded p-1.5 text-neutral-text-muted hover:bg-neutral-bg hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void cambiarActivo(p, padre)}
              aria-label={`${p.activo ? 'Desactivar' : 'Reactivar'} ${p.nombre}`}
              title={p.activo ? 'Desactivar' : 'Reactivar'}
              className="rounded p-1.5 text-neutral-text-muted hover:bg-risk-critical/10 hover:text-risk-critical focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
            >
              <Power className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        )}
      </div>
    );
  }

  const tituloForm = form
    ? form.modo === 'crear'
      ? form.padre
        ? `Nuevo subpunto de «${form.padre.nombre}»`
        : 'Nuevo punto fijo'
      : `Editar «${form.padre ? `${form.padre.nombre} · ` : ''}${form.punto!.nombre}»`
    : '';
  const puedeCrear = Boolean(jurisdiccion && (!jurisdiccion.restringido || jurisdiccion.miEpi));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Puntos Fijos" widthClassName="max-w-[980px]" accent="gold">
      <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-text-muted" aria-hidden="true" />
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar punto…"
                aria-label="Buscar punto fijo"
                className="h-9 w-full rounded-md border border-neutral-border pl-8 pr-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
              />
            </div>
            {puedeCrear && (
              <Button type="button" variant="brand" onClick={() => abrirCrear(null)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Nuevo
              </Button>
            )}
          </div>
          <label className="mb-2 flex items-center gap-1.5 text-[12px] text-neutral-text">
            <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} className="accent-primary-700" />
            Mostrar desactivados
          </label>
          <div className="scrollbar-hidden max-h-[440px] overflow-y-auto rounded-lg border border-neutral-border">
            {cargando && puntos.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-text-muted">Cargando…</p>
            ) : visibles.length === 0 ? (
              <p className="py-8 text-center text-sm text-neutral-text-muted">No hay puntos fijos{busqueda ? ' que coincidan' : ''}.</p>
            ) : (
              <ul className="divide-y divide-neutral-bg">
                {visibles.map((p) => (
                  <li key={p.id} className="py-0.5">
                    {fila(p, null)}
                    {p.subpuntos
                      .filter((s) => verInactivos || s.activo)
                      .map((s) => (
                        <Fragment key={s.id}>{fila(s, p)}</Fragment>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2 text-[11px] text-neutral-text-muted">
            <Users className="mr-1 inline h-3 w-3" aria-hidden="true" />
            Ocupación = guardias asignados ahora / capacidad. «Aproximada»: coordenadas de referencia, pendientes de validar en campo.
          </p>
        </div>

        <div className="flex flex-col">
          {form ? (
            <>
              <p className="mb-2 text-[13px] font-semibold text-primary-900">{tituloForm}</p>
              <div className="relative mb-3 h-[260px] overflow-hidden rounded-lg border border-neutral-border">
                <MapCanvas>
                  <MapSearch />
                  <EpiJurisdictionLayer jurisdiccion={jurisdiccion} soloPropia ajustarVista={!form.pos} />
                  <CapturaClic onClick={alHacerClic} />
                  <Centrar en={form.punto ? { lat: form.punto.lat, lng: form.punto.lng } : form.padre ? { lat: form.padre.lat, lng: form.padre.lng } : null} />
                  {form.padre && (
                    <CircleMarker center={[form.padre.lat, form.padre.lng]} radius={6} pathOptions={{ color: '#fff', weight: 2, fillColor: '#1A1A1A', fillOpacity: 1 }} />
                  )}
                  {form.punto && movido && (
                    <CircleMarker center={[form.punto.lat, form.punto.lng]} radius={6} pathOptions={{ color: '#6B7280', weight: 2, dashArray: '3 3', fillOpacity: 0 }} />
                  )}
                  {form.pos && <Marker position={[form.pos.lat, form.pos.lng]} icon={pinNuevo} />}
                </MapCanvas>
              </div>
              <p className="mb-3 text-[11.5px] text-neutral-text-muted">
                {form.pos ? 'Haz clic en el mapa para cambiar la ubicación.' : 'Haz clic en el mapa para ubicar el punto.'}
                {form.padre ? ` Debe estar a menos de ${DISTANCIA_MAX_SUBPUNTO_M / 1000} km de «${form.padre.nombre}».` : ''}
                {lejosDelPadre ? ' (Está demasiado lejos.)' : ''}
              </p>
              <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required disabled={guardando} accent="gold" />
                {conSubpuntos ? (
                  <Input label="Capacidad (suma de subpuntos)" value={form.capacidad} disabled readOnly accent="gold" />
                ) : (
                  <Input
                    label="Capacidad (guardias)"
                    type="number"
                    min={1}
                    max={50}
                    value={form.capacidad}
                    onChange={(e) => setForm({ ...form, capacidad: e.target.value })}
                    error={capacidadValida ? undefined : 'Entre 1 y 50.'}
                    helperText={form.punto && form.punto.ocupados > 0 ? `Ahora hay ${form.punto.ocupados} asignado(s): no puede ser menor.` : undefined}
                    disabled={guardando}
                    accent="gold"
                  />
                )}
              </div>
              <div className="mb-3">
                <Input label="Descripción (opcional)" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} disabled={guardando} accent="gold" />
              </div>
              {esSuperAdmin && !form.padre && !form.punto?.padreId && (
                <div className="mb-3">
                  <Select label="EPI" value={form.epiCodigo} onChange={(e) => setForm({ ...form, epiCodigo: e.target.value })} disabled={guardando} accent="gold">
                    <option value="">Según la ubicación del punto</option>
                    {epis.map((e) => (
                      <option key={e.codigo} value={e.codigo}>
                        {nombreEpi(e.codigo)} (asignar a mano)
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <label className="mb-3 flex items-start gap-2 text-[12px] text-neutral-text">
                <input type="checkbox" checked={form.verificada} onChange={(e) => setForm({ ...form, verificada: e.target.checked })} disabled={guardando} className="mt-0.5 accent-primary-700" />
                Ubicación verificada en campo (si no, se muestra como aproximada)
              </label>
              {movido && ocupadosAqui > 0 && (
                <fieldset className="mb-3 rounded-lg border border-risk-medium/40 bg-risk-medium/5 p-3 text-[12px]">
                  <legend className="px-1 font-semibold text-[#B45309]">Tiene {ocupadosAqui} guardia(s) asignado(s)</legend>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="politica" checked={form.politica === 'trasladar'} onChange={() => setForm({ ...form, politica: 'trasladar' })} />
                    Trasladarlos a la nueva ubicación (verán el nuevo destino en su celular)
                  </label>
                  <label className="mt-1 flex items-center gap-2">
                    <input type="radio" name="politica" checked={form.politica === 'retirar'} onChange={() => setForm({ ...form, politica: 'retirar' })} />
                    Retirarlos del punto
                  </label>
                </fieldset>
              )}
              {error && (
                <div role="alert" className="mb-3 rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2 text-xs text-risk-critical">
                  {error}
                </div>
              )}
              <div className="mt-auto flex gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setForm(null)} disabled={guardando} className="flex-1">
                  Cancelar
                </Button>
                <Button type="button" variant="brand" onClick={() => void guardar()} isLoading={guardando} disabled={!formValido} className="flex-1">
                  Guardar
                </Button>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-border p-6 text-center text-[12.5px] text-neutral-text-muted">
              <Flag className="mb-2 h-6 w-6 text-primary-700" aria-hidden="true" />
              Elige «Nuevo» para agregar un punto fijo, o el lápiz de un punto de tu EPI para editarlo.
              <br />
              Con «+» se agregan subpuntos (por ejemplo, Plataforma e Inicio de gradas).
              {error && <span className="mt-2 text-risk-critical">{error}</span>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
