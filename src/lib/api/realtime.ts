'use client';

// Cliente Socket.io hacia el canal real-time del API (gamc-api).
//
// Autenticación: el navegador conecta DIRECTO a este servidor (dominio de
// Render), distinto del dominio de Vercel donde vive la cookie httpOnly
// `gamc_access` — por eso NO le llega vía cookie en producción (sí en dev,
// localhost:3000 <-> localhost:4000, donde el puerto no separa dominio).
// El token se pasa explícito en `auth.token` (obtenido con una Server Action
// que sí puede leer la cookie httpOnly) como mecanismo real de producción;
// `withCredentials` se deja como red de respaldo para el caso local. Si el
// API no responde o rechaza la conexión, el mapa/dashboard siguen
// funcionando vía HTTP (recarga manual): el push en vivo es una mejora, no
// una dependencia.
//
// Conexión ÚNICA por sesión: la abre/cierra RealtimeProvider (una sola vez
// al montar el layout autenticado, ver lib/realtime/RealtimeProvider.tsx) —
// esta función no cachea un singleton propio, así que no debe llamarse
// directo fuera de ahí.

import { io, type Socket } from 'socket.io-client';
import { apiConfig } from '@/lib/env';

export const REALTIME_EVENTS = {
  guardiaUbicacion: 'guardia:ubicacion',
  guardiaEstado: 'guardia:estado',
  sosNuevo: 'sos:nuevo',
  hechoActualizado: 'hecho:actualizado',
  patrullaAsignada: 'patrulla:asignada',
  patrullaCancelada: 'patrulla:cancelada',
} as const;

// `auth` se pasa como FUNCIÓN (no un objeto estático) — socket.io-client la
// re-invoca en cada intento de conexión, incluyendo reconexiones
// automáticas (caída de red, el API se reinicia, la laptop despierta de
// suspensión...). Con un objeto estático, una reconexión reenvía SIEMPRE el
// mismo access token con el que se montó el Provider; pasados los 15 min de
// vida del access token (ACCESS_TOKEN_MINUTES en el backend) esa reconexión
// falla la autenticación para siempre y el socket queda muerto en
// silencio — el mapa/dashboard dejan de recibir push en vivo sin que nadie
// se entere, y solo el TTL del caché (minutos) termina "corrigiendo" el
// dato. `getToken` deja pedir un token fresco en cada intento.
export function connectRealtime(getToken: () => Promise<string | null>): Socket {
  const url = apiConfig.websocketUrl || apiConfig.baseUrl || 'http://localhost:4000';
  return io(url, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: async (cb) => {
      const token = await getToken().catch(() => null);
      cb(token ? { token } : {});
    },
  });
}
