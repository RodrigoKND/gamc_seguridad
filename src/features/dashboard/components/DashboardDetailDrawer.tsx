'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RISK_LEVEL_BADGE_CLASS } from '@/types/risk';
import { EpiNombre } from '@/lib/epis/EpiNombre';
import { HECHO_ESTADO_BADGE_CLASS, HECHO_ESTADO_LABELS } from '@/features/hechos/types';
import type { Hecho } from '@/features/hechos/types';
import type { Guard } from '@/features/guardias/types';

export interface DetailData {
  title: string;
  subtitle?: string;
  hechos?: Hecho[];
  guards?: Guard[];
}

export interface DashboardDetailDrawerProps {
  data: DetailData | null;
  onClose: () => void;
  /** Marca un hecho como resuelto sin salir del Dashboard — antes solo se podía desde /hechos. */
  onResolveHecho?: (id: string) => Promise<boolean>;
  /** Resuelve el SOS de un guardia (vuelve a en_servicio) sin salir del Dashboard. */
  onResolveSos?: (guardiaId: string) => Promise<boolean>;
}

export function DashboardDetailDrawer({ data, onClose, onResolveHecho, onResolveSos }: DashboardDetailDrawerProps) {
  const router = useRouter();
  const isOpen = Boolean(data);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleResolveHecho(id: string) {
    if (!onResolveHecho) return;
    setPendingId(id);
    await onResolveHecho(id);
    setPendingId(null);
  }

  async function handleResolveSos(guardiaId: string) {
    if (!onResolveSos) return;
    setPendingId(guardiaId);
    await onResolveSos(guardiaId);
    setPendingId(null);
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      widthClassName="w-[480px]"
      header={
        <div>
          <p className="text-sm font-bold">{data?.title ?? ''}</p>
          {data?.subtitle && <p className="text-xs opacity-80">{data.subtitle}</p>}
        </div>
      }
    >
      {data?.hechos && data.hechos.length > 0 && (
        <div className="space-y-2">
          {data.hechos.slice(0, 20).map((h) => (
            <div key={h.id} className="rounded-lg border border-neutral-border p-3">
              <p className="text-sm font-medium text-neutral-text">{h.tipo} — {h.narrativa.slice(0, 80)}</p>
              <p className="mt-1 flex flex-wrap gap-2 text-xs">
                <Badge className={RISK_LEVEL_BADGE_CLASS[h.severidad]}>{h.severidad}</Badge>
                <Badge className={HECHO_ESTADO_BADGE_CLASS[h.estado]}>{HECHO_ESTADO_LABELS[h.estado]}</Badge>
                <span className="text-neutral-text-muted"><EpiNombre codigo={h.epi} /></span>
              </p>
              <p className="mt-1 text-xs text-neutral-text-muted">{h.ubicacion} · {h.timestamp}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="!px-2.5 !py-1 !text-[11px]"
                  onClick={() => router.push(`/hechos?q=${h.id}`)}
                >
                  Ver en Reportes
                </Button>
                {h.estado !== 'resuelto' && onResolveHecho && (
                  <Button
                    type="button"
                    variant="brand"
                    className="!px-2.5 !py-1 !text-[11px]"
                    disabled={pendingId === h.id}
                    onClick={() => handleResolveHecho(h.id)}
                  >
                    {pendingId === h.id ? 'Marcando…' : 'Marcar como resuelto'}
                  </Button>
                )}
              </div>
            </div>
          ))}
          {data.hechos.length > 20 && <p className="text-center text-xs text-neutral-text-muted">+{data.hechos.length - 20} más</p>}
        </div>
      )}
      {data?.guards && data.guards.length > 0 && (
        <div className="space-y-2">
          {data.guards.slice(0, 20).map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-lg border border-neutral-border p-3">
              <span className="avatar-initials h-8 w-8 text-xs">{g.primerNombre[0]}{g.apellidoPaterno[0]}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{g.primerNombre} {g.apellidoPaterno}</p>
                <p className="text-xs text-neutral-text-muted"><EpiNombre codigo={g.epi} /> · {g.operationalStatus}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="!px-2.5 !py-1 !text-[11px]"
                  onClick={() => router.push(`/mapas?guardiaId=${g.id}`)}
                >
                  Ver en Mapa
                </Button>
                {g.operationalStatus === 'emergencia' && onResolveSos && (
                  <Button
                    type="button"
                    variant="brand"
                    className="!px-2.5 !py-1 !text-[11px]"
                    disabled={pendingId === g.id}
                    onClick={() => handleResolveSos(g.id)}
                  >
                    {pendingId === g.id ? 'Resolviendo…' : 'Resolver SOS'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {data && (!data.hechos || data.hechos.length === 0) && (!data.guards || data.guards.length === 0) && (
        <p className="py-8 text-center text-sm text-neutral-text-muted">Sin resultados para este filtro.</p>
      )}
    </Drawer>
  );
}
