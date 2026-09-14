'use client';

// Recarga los datos del mapa cuando el API empuja eventos en vivo
// (telemetría, SOS, estado de guardia, patrulla asignada/cancelada, hecho
// actualizado). Usa el socket COMPARTIDO de RealtimeProvider — no abre ni
// cierra su propia conexión al montar/desmontar la vista de Mapas.

import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';

export function useRealtimeMap(onEvent: () => void) {
  // guardiaUbicacion se maneja optimistamente en MapasView (mueve el pin sin
  // fetch) — no dispara reload completo para no saturar el API con cada ping GPS.
  useRealtimeEvent(REALTIME_EVENTS.guardiaEstado, onEvent);
  useRealtimeEvent(REALTIME_EVENTS.sosNuevo, onEvent);
  useRealtimeEvent(REALTIME_EVENTS.patrullaAsignada, onEvent);
  useRealtimeEvent(REALTIME_EVENTS.patrullaCancelada, onEvent);
  useRealtimeEvent(REALTIME_EVENTS.hechoActualizado, onEvent);
}
