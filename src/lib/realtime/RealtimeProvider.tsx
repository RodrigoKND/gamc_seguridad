'use client';

// Conexión Socket.io ÚNICA para toda la sesión autenticada — antes cada
// vista (Mapas, y a futuro Guardias/Dashboard) abría y cerraba su propio
// socket al navegar entre pantallas. Este Provider vive en el layout del
// grupo (dashboard) (una sola vez por sesión) y expone la conexión vía
// Context; cada vista solo se suscribe/desuscribe a los eventos que le
// interesan con `useRealtimeEvent`, sin abrir conexiones nuevas.

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { connectRealtime, REALTIME_EVENTS } from '@/lib/api/realtime';
import { getRealtimeTicketAction } from '@/lib/api/realtimeTicket';

type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

const RealtimeContext = createContext<Socket | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // connectRealtime recibe la FUNCIÓN, no un token ya resuelto — así cada
    // intento de conexión (incluidas las reconexiones automáticas de
    // socket.io) pide una cookie fresca en vez de reusar para siempre la que
    // había al montar el Provider (ver comentario en lib/api/realtime.ts).
    const s = connectRealtime(getRealtimeTicketAction);
    socketRef.current = s;
    setSocket(s);
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
    // Una sola conexión por sesión montada — no depende de la ruta actual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>;
}

/** Acceso directo al socket compartido — null mientras conecta o si el canal no está disponible. */
export function useRealtimeSocket(): Socket | null {
  return useContext(RealtimeContext);
}

/**
 * Suscribe `handler` a un evento del canal compartido mientras el componente
 * esté montado. No abre/cierra conexiones — solo agrega/quita el listener.
 */
export function useRealtimeEvent<T = unknown>(event: RealtimeEventName, handler: (payload: T) => void) {
  const socket = useRealtimeSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!socket) return;
    const listener = (payload: T) => handlerRef.current(payload);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
