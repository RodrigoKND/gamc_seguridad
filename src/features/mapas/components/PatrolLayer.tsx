'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Route } from 'lucide-react';
import { Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { EPI_ZONE_HEX } from '@/types/epi';
import { OPERATIONAL_STATUS_LABELS } from '@/features/guardias/types';
import { safePhotoUrl } from '../lib/safeIconUrl';
import { createMarkerAnimator } from '../lib/markerAnimator';
import type { GuardMarker } from '../types';

// RF/RNF: Tab Patrullaje en Vivo — RF-G1-01/02, RF-G3-09/10 (MASTER.md sección 7.3).
//
// Pin coloreado por zona EPI (divIcon HTML — evita el problema clásico de
// Leaflet+bundlers con los íconos por defecto). Header pulsante rojo si el
// guardia tiene SOS activo (MASTER.md sección 9).
//
// Agrupamiento (Caso B — MASTER.md "Rediseño de Asignación de Rutas"):
// cuando 2+ guardias quedan a pocos metros entre sí (ej. los ocupantes de
// un mismo coche, con el jitter que simula que cada uno reporta desde su
// propio celular), MarkerClusterGroup los agrupa en una sola insignia; un
// clic los separa en abanico (spiderfy, comportamiento de
// Leaflet.markercluster) para poder tocar cualquiera individualmente — así
// nunca hace falta acertarle a un pin exacto entre varios superpuestos.
// El radio de cluster es chico a propósito (40px) para que solo agrupe
// puntos genuinamente cercanos, no guardias de la misma zona EPI que están
// a varias cuadras.
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

function createGuardIcon(guard: GuardMarker, isSelected: boolean) {
  const zoneColor = EPI_ZONE_HEX[guard.zone] ?? '#4D3B86';
  const photoUrl = safePhotoUrl(guard.fotoUrl);
  const fill = photoUrl
    ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;`
    : `background:${zoneColor};`;
  const label = photoUrl ? '' : guard.label;
  const pulseClass = guard.hasSos ? 'animate-pulse' : '';
  const ringStyle = guard.hasSos
    ? (isSelected ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px #DC2626,0 0 0 9px #E8567F;' : 'box-shadow:0 0 0 3px #fff,0 0 0 6px #DC2626;')
    : (isSelected ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px #E8567F;' : 'box-shadow:0 1px 4px rgba(58,44,107,.35);');

  return L.divIcon({
    className: '',
    html: `<div class="${pulseClass}" style="width:26px;height:26px;border-radius:9999px;${fill}border:2px solid #fff;${ringStyle}color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const hasSos = cluster.getAllChildMarkers().some((m: L.Marker) => (m.options as { hasSos?: boolean }).hasSos);
  const bg = hasSos ? '#DC2626' : '#6B559F';
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:${bg};border:2.5px solid #E8567F;box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

interface GuardMapMarkerProps {
  guard: GuardMarker;
  initialPosition: [number, number];
  isSelected: boolean;
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
  function GuardMapMarker({ guard, initialPosition, isSelected, onSelectGuard, markerRef }: GuardMapMarkerProps) {
    return (
      <Marker
        ref={(instance) => markerRef(guard.id, instance)}
        position={initialPosition}
        icon={createGuardIcon(guard, isSelected)}
        // hasSos viaja en options (react-leaflet pasa todas las props no
        // reconocidas al constructor de L.Marker) para que
        // createClusterIcon pueda leerlo vía getAllChildMarkers() sin
        // acoplarse a GuardMarker.
        {...{ hasSos: guard.hasSos }}
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
  const initialPosRef = useRef(new Map<string, [number, number]>());

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
        initialPosRef.current.delete(id);
        markersRef.current.delete(id);
        animator.forget(id);
      }
    }
  }, [guards, animator]);

  return (
    <MarkerClusterGroup
      maxClusterRadius={40}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      zoomToBoundsOnClick={false}
      iconCreateFunction={createClusterIcon}
    >
      {guards.map((guard) => {
        if (!initialPosRef.current.has(guard.id)) {
          initialPosRef.current.set(guard.id, [guard.lat, guard.lng]);
        }
        return (
          <GuardMapMarker
            key={guard.id}
            guard={guard}
            initialPosition={initialPosRef.current.get(guard.id)!}
            isSelected={guard.id === selectedId}
            onSelectGuard={onSelectGuard}
            markerRef={setMarkerRef}
          />
        );
      })}
    </MarkerClusterGroup>
  );
});
