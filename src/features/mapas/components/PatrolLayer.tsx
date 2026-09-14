'use client';

import L from 'leaflet';
import { Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { EPI_ZONE_HEX } from '@/types/epi';
import { OPERATIONAL_STATUS_LABELS } from '@/features/guardias/types';
import { safePhotoUrl } from '../lib/safeIconUrl';
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

// Un guardia en SOS ya NO tapa la foto con un relleno rojo sólido — la
// identidad (foto o iniciales) se mantiene visible siempre; la emergencia
// se marca con un anillo rojo parpadeante alrededor (pedido explícito
// 2026-09-14: "en lugar de hacer el pin del color rojo... que lo rodee un
// borde rojo y parpadeante dejando ver la imagen").
function createGuardIcon(guard: GuardMarker, isSelected: boolean) {
  const zoneColor = EPI_ZONE_HEX[guard.zone] ?? '#1A1A1A';
  const photoUrl = safePhotoUrl(guard.fotoUrl);
  const fill = photoUrl
    ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;`
    : `background:${zoneColor};`;
  const label = photoUrl ? '' : guard.label;
  const pulseClass = guard.hasSos ? 'animate-pulse' : '';
  const ringStyle = guard.hasSos
    ? (isSelected ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px #DC2626,0 0 0 9px #A97F52;' : 'box-shadow:0 0 0 3px #fff,0 0 0 6px #DC2626;')
    : (isSelected ? 'box-shadow:0 0 0 3px #fff,0 0 0 6px #A97F52;' : 'box-shadow:0 1px 4px rgba(0,0,0,.35);');

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
  const bg = hasSos ? '#DC2626' : '#1A1A1A';
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;border-radius:9999px;background:${bg};border:2.5px solid #C59B6D;box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${count}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

export interface PatrolLayerProps {
  guards: GuardMarker[];
  selectedId?: string | null;
  onSelectGuard?: (guard: GuardMarker) => void;
}

export function PatrolLayer({ guards, selectedId, onSelectGuard }: PatrolLayerProps) {
  return (
    <MarkerClusterGroup
      maxClusterRadius={40}
      spiderfyOnMaxZoom
      showCoverageOnHover={false}
      zoomToBoundsOnClick={false}
      iconCreateFunction={createClusterIcon}
    >
      {guards.map((guard) => (
        <Marker
          key={guard.id}
          position={[guard.lat, guard.lng]}
          icon={createGuardIcon(guard, guard.id === selectedId)}
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
          </Popup>
        </Marker>
      ))}
    </MarkerClusterGroup>
  );
}
