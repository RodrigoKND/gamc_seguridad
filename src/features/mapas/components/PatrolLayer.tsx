'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Route } from 'lucide-react';
import { Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { useEpiCatalogo } from '@/lib/epis/EpiCatalogProvider';
import { OPERATIONAL_STATUS_LABELS } from '@/features/guardias/types';
import { safePhotoUrl } from '../lib/safeIconUrl';
import { createMarkerAnimator } from '../lib/markerAnimator';
import { PANES, radioCluster } from '../lib/capas';
import type { GuardMarker } from '../types';

// RF/RNF: Tab Patrullaje en Vivo — RF-G1-01/02, RF-G3-09/10 (MASTER.md sección 7.3).
//
// Pin coloreado por zona EPI (divIcon HTML — evita el problema clásico de
// Leaflet+bundlers con los íconos por defecto). Header pulsante rojo si el
// guardia tiene SOS activo (MASTER.md sección 9).
//
// Agrupamiento (Caso B — MASTER.md "Rediseño de Asignación de Rutas"),
// revisado 16/10 con las normas de Leaflet.markercluster:
//  · se agrupan SOLO guardias (una capa, un tipo): puntos fijos, sedes y
//    módulos nunca se mezclan en un grupo;
//  · lo prioritario NUNCA queda escondido dentro de un grupo: un guardia con
//    SOS y el guardia seleccionado se dibujan sueltos, en su propio pane por
//    encima del resto (capas.ts);
//  · radio según zoom (radioCluster): amplio en la vista de ciudad, mínimo a
//    nivel de calle, así de cerca solo se agrupa lo que de verdad está
//    encimado (los ocupantes de un mismo coche);
//  · clic en el número = acercar hasta que el grupo se desglose
//    (zoomToBounds); en el zoom máximo, abanico (spiderfy);
//  · el ícono del grupo crece con la cantidad (3 tamaños) y toma el color del
//    PEOR estado que contiene (fuera de ruta > advertencia > incorporándose),
//    para no perder una alerta por estar agrupada;
//  · carga por tramos (chunkedLoading) y sin dibujar lo que está fuera de la
//    vista (removeOutsideVisibleBounds, por defecto): fluido con muchos guardias.
//
// Movimiento fluido (pedido explícito: "que se sienta muy fluido... como
// Uber", con muchos guardias conectados a la vez): el pin ya NO salta de
// golpe a la nueva posición en cada ping — se interpola (markerAnimator.ts,
// ver ahí el porqué de no poder animar con `setLatLng` directo dentro de un
// cluster). Para que esto no dependa de re-renderizar los N marcadores en
// cada ping de CUALQUIER guardia (antes: `guards` cambia de referencia en
// cada ping → los N <Marker> recibían un `icon`/`position` nuevos → los N
// se re-creaban en el DOM aunque solo 1 se movió), la posición se pasa una
// sola vez al montar (GuardMapMarker está memoizado y el efecto de abajo
// mueve el marcador imperativamente vía ref, no vía prop) y el ícono/popup
// solo se recalculan si algo que de verdad se ve cambió (memo compara
// campo por campo, no la referencia completa de `guard`).

function createGuardIcon(guard: GuardMarker, isSelected: boolean, zoneColor: string) {
  const photoUrl = safePhotoUrl(guard.fotoUrl);
  const fill = photoUrl
    ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;`
    : `background:${zoneColor};`;
  const label = photoUrl ? '' : guard.label;
  const pulseClass = guard.hasSos ? 'sos-sonar' : '';
  const ringStyle = guard.hasSos
    ? (isSelected ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px #DC2626,0 0 0 9px #C59B6D;' : 'box-shadow:0 0 0 3px #fff,0 0 0 6px #DC2626;')
    : (isSelected ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px #C59B6D;' : 'box-shadow:0 1px 4px rgba(13,13,14,.35);');

  return L.divIcon({
    className: '',
    html: `<div class="${pulseClass}" style="width:26px;height:26px;border-radius:9999px;${fill}border:2px solid #fff;${ringStyle}color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

// Estado de ruta por guardia, leído por el ícono de los grupos. Va en un
// Map (no en las options del marcador) porque Leaflet no actualiza options
// después de crear el marcador; PatrolLayer lo refresca cuando cambia.
const estadoPorGuardia = new Map<string, GuardMarker['estadoRuta']>();
const PESO_ESTADO: Record<string, number> = { alerta: 3, advertencia: 2, incorporandose: 1 };
const COLOR_ESTADO: Record<number, string> = { 3: '#DC2626', 2: '#F59E0B', 1: '#3B82F6' };

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  let peor = 0;
  for (const m of cluster.getAllChildMarkers()) {
    const id = (m.options as { guardiaId?: string }).guardiaId ?? '';
    peor = Math.max(peor, PESO_ESTADO[estadoPorGuardia.get(id) ?? ''] ?? 0);
  }
  const tam = count < 10 ? 34 : count < 50 ? 40 : 46;
  const borde = COLOR_ESTADO[peor] ?? '#C59B6D';
  const aviso = peor >= 2 ? `<span style="position:absolute;right:-3px;top:-3px;width:12px;height:12px;border-radius:9999px;background:${borde};border:2px solid #fff"></span>` : '';
  return L.divIcon({
    className: '',
    html: `<div title="${count} guardias agrupados — clic para acercar" style="position:relative;width:${tam}px;height:${tam}px;border-radius:9999px;background:#1A1A1A;border:3px solid ${borde};box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font-size:${count < 10 ? 12 : 13}px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${count}${aviso}</div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  });
}

interface GuardMapMarkerProps {
  guard: GuardMarker;
  isSelected: boolean;
  /** Pane propio para los prioritarios (SOS / seleccionado); los demás van en markerPane. */
  pane?: string;
  onSelectGuard?: (guard: GuardMarker) => void;
  markerRef: (id: string, instance: L.Marker | null) => void;
}

// Memoizado campo a campo (no por referencia de `guard`): `guards` cambia
// de array en CADA ping de CUALQUIER guardia (MapasView reemplaza el
// array completo), así que comparar `prev.guard === next.guard` haría que
// los N marcadores se re-crearan N veces por cada ping de 1 solo guardia.
// lat/lng se excluyen a propósito — el movimiento lo maneja el efecto de
// PatrolLayer vía el animador imperativo, no un re-render de este componente.
const GuardMapMarker = React.memo(
  function GuardMapMarker({ guard, isSelected, pane, onSelectGuard, markerRef }: GuardMapMarkerProps) {
    // Posición al MONTAR (no la primera vez que se vio al guardia): si pasa de
    // un grupo a la capa prioritaria se vuelve a montar donde está ahora.
    const [initialPosition] = useState<[number, number]>(() => [guard.lat, guard.lng]);
    // Color desde el catálogo dinámico (antes EPI_ZONE_HEX fijo). El
    // contexto re-renderiza este marcador si el catálogo cambia, aunque
    // el memo de abajo compare solo campos del guardia.
    const { color } = useEpiCatalogo();
    return (
      <Marker
        ref={(instance) => markerRef(guard.id, instance)}
        position={initialPosition}
        icon={createGuardIcon(guard, isSelected, color(guard.zone))}
        {...(pane ? { pane } : {})}
        zIndexOffset={guard.hasSos ? 2000 : isSelected ? 1000 : 0}
        // guardiaId viaja en options (react-leaflet pasa las props no
        // reconocidas al constructor de L.Marker) para que createClusterIcon
        // encuentre el estado de cada guardia agrupado.
        {...{ guardiaId: guard.id }}
        eventHandlers={onSelectGuard ? { click: () => onSelectGuard(guard) } : undefined}
      >
        <Popup>
          <p className="text-[13px] font-bold">{guard.nombre}</p>
          <p className="text-xs text-neutral-text-muted">
            {OPERATIONAL_STATUS_LABELS[guard.operationalStatus]} · {guard.ubicacionActual}
          </p>
          {guard.rutaAsignada && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary-800">
              <Route className="h-3 w-3 shrink-0" aria-hidden="true" />
              {guard.rutaAsignada.nombre}
            </p>
          )}
        </Popup>
      </Marker>
    );
  },
  (prev, next) =>
    prev.guard.id === next.guard.id &&
    prev.guard.zone === next.guard.zone &&
    prev.guard.fotoUrl === next.guard.fotoUrl &&
    prev.guard.label === next.guard.label &&
    prev.guard.hasSos === next.guard.hasSos &&
    prev.guard.nombre === next.guard.nombre &&
    prev.guard.ubicacionActual === next.guard.ubicacionActual &&
    prev.guard.operationalStatus === next.guard.operationalStatus &&
    prev.guard.rutaAsignada?.nombre === next.guard.rutaAsignada?.nombre &&
    prev.isSelected === next.isSelected &&
    prev.pane === next.pane &&
    prev.onSelectGuard === next.onSelectGuard,
);

export interface PatrolLayerProps {
  guards: GuardMarker[];
  selectedId?: string | null;
  onSelectGuard?: (guard: GuardMarker) => void;
}

export const PatrolLayer = React.memo(function PatrolLayer({ guards, selectedId, onSelectGuard }: PatrolLayerProps) {
  const map = useMap();
  const animator = useMemo(() => createMarkerAnimator(map), [map]);
  const markersRef = useRef(new Map<string, L.Marker>());
  const lastPosRef = useRef(new Map<string, { lat: number; lng: number }>());
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => () => animator.destroy(), [animator]);

  function setMarkerRef(id: string, instance: L.Marker | null) {
    if (instance) markersRef.current.set(id, instance);
    else markersRef.current.delete(id);
  }

  // Mueve (animado) cualquier guardia cuya posición real cambió desde el
  // último render, y limpia el rastro de los que ya no están en la lista.
  useEffect(() => {
    const seen = new Set<string>();
    for (const guard of guards) {
      seen.add(guard.id);
      const prev = lastPosRef.current.get(guard.id);
      if (!prev) {
        // Primera vez que se ve este guardia — ya quedó bien ubicado por
        // `initialPosition` al montar, no hace falta animar.
        lastPosRef.current.set(guard.id, { lat: guard.lat, lng: guard.lng });
        continue;
      }
      if (prev.lat !== guard.lat || prev.lng !== guard.lng) {
        const marker = markersRef.current.get(guard.id);
        if (marker) animator.moveTo(guard.id, marker, guard.lat, guard.lng);
        lastPosRef.current.set(guard.id, { lat: guard.lat, lng: guard.lng });
      }
    }
    for (const id of Array.from(lastPosRef.current.keys())) {
      if (!seen.has(id)) {
        lastPosRef.current.delete(id);
        markersRef.current.delete(id);
        animator.forget(id);
      }
    }
  }, [guards, animator]);

  // Los grupos se redibujan solo al hacer zoom/pan: si cambia el estado de
  // algún guardia agrupado, se refrescan los íconos para no mostrar un color viejo.
  const firmaEstados = guards.map((g) => `${g.id}:${g.estadoRuta ?? ''}`).join('|');
  useEffect(() => {
    estadoPorGuardia.clear();
    for (const g of guards) estadoPorGuardia.set(g.id, g.estadoRuta ?? null);
    clusterRef.current?.refreshClusters();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- basta con la firma de estados
  }, [firmaEstados]);

  const esPrioritario = (g: GuardMarker) => g.hasSos === true || g.id === selectedId;
  const agrupables = guards.filter((g) => !esPrioritario(g));
  const prioritarios = guards.filter(esPrioritario);

  return (
    <>
      <MarkerClusterGroup
        ref={clusterRef}
        maxClusterRadius={radioCluster}
        spiderfyOnMaxZoom
        showCoverageOnHover={false}
        zoomToBoundsOnClick
        chunkedLoading
        iconCreateFunction={createClusterIcon}
      >
        {agrupables.map((guard) => (
          <GuardMapMarker key={guard.id} guard={guard} isSelected={false} onSelectGuard={onSelectGuard} markerRef={setMarkerRef} />
        ))}
      </MarkerClusterGroup>
      {prioritarios.map((guard) => (
        <GuardMapMarker
          key={`p-${guard.id}`}
          guard={guard}
          isSelected={guard.id === selectedId}
          pane={PANES.prioritarios.name}
          onSelectGuard={onSelectGuard}
          markerRef={setMarkerRef}
        />
      ))}
    </>
  );
});
