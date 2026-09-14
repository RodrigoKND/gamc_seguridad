'use client';

// Envuelve useRelativeTime en un componente para poder usarlo dentro de
// listas (.map) sin violar las reglas de hooks — el hook en sí no puede
// llamarse directo dentro del callback de un .map().

import { useRelativeTime } from '@/lib/hooks/useRelativeTime';

export function LiveRelativeTime({ iso, fallback }: { iso: string; fallback: string }) {
  return <>{useRelativeTime(iso, fallback)}</>;
}
