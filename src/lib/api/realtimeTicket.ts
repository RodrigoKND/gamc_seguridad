'use server';

import { cookies } from 'next/headers';

// El WebSocket conecta DIRECTO desde el navegador al backend (dominio de
// Render) — no pasa por el proxy same-origin que usa el resto de la app
// (Next.js reenviando cookies servidor-a-servidor). Por eso la cookie
// httpOnly `gamc_access` (seteada en el dominio de Vercel) nunca llega al
// handshake del socket en producción. Esta Server Action SÍ puede leer esa
// cookie (código de servidor) y se la entrega al cliente para que la pase
// explícitamente como `auth.token` al conectar — el mismo JWT que el
// navegador ya tiene en su propia cookie, solo que reenviado por otro canal.
// Se mantiene únicamente en memoria del lado del cliente (nunca localStorage).
export async function getRealtimeTicketAction(): Promise<string | null> {
  const store = await cookies();
  return store.get('gamc_access')?.value ?? null;
}
