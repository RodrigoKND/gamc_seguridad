import L from 'leaflet';

// Movimiento suave de los pines de guardias en vivo (pedido explícito:
// "que se sienta muy fluido... como Uber"). Antes cada ping de GPS movía el
// pin de un salto (`setLatLng` directo vía el prop `position` del
// <Marker>), lo que se ve "a tirones" cuando los pings llegan cada
// 15-90s. Ahora se interpola la posición visual entre el punto anterior y
// el nuevo durante `DURATION_MS`.
//
// No se puede animar llamando a `marker.setLatLng()` en cada frame: los
// guardias viven dentro de un <MarkerClusterGroup> (PatrolLayer.tsx), y
// Leaflet.markercluster escucha el evento 'move' de cada marcador hijo para
// re-clusterizar (`_childMarkerMoved` → `_moveChild` → remove+add real del
// layer) — llamar `setLatLng` 60 veces por segundo por guardia recompondría
// el clustering 60 veces por segundo por guardia, exactamente lo opuesto de
// "fluido" con muchos guardias conectados a la vez.
//
// Por eso la animación mueve el DOM del ícono directamente
// (`L.DomUtil.setPosition`, la misma utilidad que usa Leaflet internamente
// para posicionar un marcador) frame a frame, y solo llama a
// `marker.setLatLng()` UNA vez al terminar — ahí sí se paga el costo de
// re-clusterizar, pero una vez por ping real, no una vez por frame.
//
// Si el marcador está agrupado dentro de un cluster (no tiene ícono propio
// en el DOM — `getElement()` devuelve undefined) no hay nada que animar
// visualmente: se sincroniza la posición real de una sola vez. Esto además
// acota el costo de la animación a los guardias que están realmente
// visibles como pin individual en el viewport actual, no al total de
// guardias conectados.

const DURATION_MS = 1400;

interface AnimEntry {
  marker: L.Marker;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  startedAt: number;
}

export interface MarkerAnimator {
  /** Anima (o sincroniza directo si no es visible) el marcador `id` hacia [lat,lng]. */
  moveTo: (id: string, marker: L.Marker, lat: number, lng: number) => void;
  /** Deja de rastrear `id` (ej. el guardia salió de la lista). */
  forget: (id: string) => void;
  /** Cancela el loop de animación — llamar al desmontar. */
  destroy: () => void;
}

function interpolatedLatLng(e: AnimEntry, now: number): { lat: number; lng: number } {
  const t = Math.min(1, (now - e.startedAt) / DURATION_MS);
  return {
    lat: e.fromLat + (e.toLat - e.fromLat) * t,
    lng: e.fromLng + (e.toLng - e.fromLng) * t,
  };
}

export function createMarkerAnimator(map: L.Map): MarkerAnimator {
  const entries = new Map<string, AnimEntry>();
  let rafId: number | null = null;

  function tick() {
    const now = performance.now();
    const finished: [string, AnimEntry][] = [];
    for (const [id, e] of entries) {
      const { lat, lng } = interpolatedLatLng(e, now);
      const el = e.marker.getElement();
      if (el) {
        L.DomUtil.setPosition(el, map.latLngToLayerPoint([lat, lng]));
      }
      if (now - e.startedAt >= DURATION_MS) {
        finished.push([id, e]);
      }
    }
    for (const [id, e] of finished) {
      entries.delete(id);
      // Sincroniza el estado real de Leaflet una sola vez, al terminar —
      // acá es donde el cluster recompone (ver comentario arriba).
      e.marker.setLatLng([e.toLat, e.toLng]);
    }
    rafId = entries.size > 0 ? requestAnimationFrame(tick) : null;
  }

  function moveTo(id: string, marker: L.Marker, lat: number, lng: number) {
    const el = marker.getElement();
    if (!el) {
      // Agrupado en un cluster — nada visible que animar, sincronizar directo.
      entries.delete(id);
      marker.setLatLng([lat, lng]);
      return;
    }
    const now = performance.now();
    const current = entries.get(id);
    const from = current ? interpolatedLatLng(current, now) : marker.getLatLng();
    entries.set(id, { marker, fromLat: from.lat, fromLng: from.lng, toLat: lat, toLng: lng, startedAt: now });
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function forget(id: string) {
    entries.delete(id);
  }

  function destroy() {
    entries.clear();
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  return { moveTo, forget, destroy };
}
