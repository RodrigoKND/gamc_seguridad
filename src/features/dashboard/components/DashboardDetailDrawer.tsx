'use client';

import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { RISK_LEVEL_BADGE_CLASS } from '@/types/risk';
import { EPI_ZONE_LABELS } from '@/types/epi';
import { HECHO_ESTADO_BADGE_CLASS, HECHO_ESTADO_LABELS } from '@/features/hechos/types';
import type { Hecho } from '@/features/hechos/types';
import type { Guard } from '@/features/guardias/types';

export interface DetailData {
  title: string;
  subtitle?: string;
  hechos?: Hecho[];
  guards?: Guard[];
}

export function DashboardDetailDrawer({ data, onClose }: { data: DetailData | null; onClose: () => void }) {
  const isOpen = Boolean(data);
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
                <span className="text-neutral-text-muted">EPI {EPI_ZONE_LABELS[h.epi]}</span>
              </p>
              <p className="mt-1 text-xs text-neutral-text-muted">{h.ubicacion} · {h.timestamp}</p>
            </div>
          ))}
          {data.hechos.length > 20 && <p className="text-center text-xs text-neutral-text-muted">+{data.hechos.length - 20} más</p>}
        </div>
      )}
      {data?.guards && data.guards.length > 0 && (
        <div className="space-y-2">
          {data.guards.slice(0, 20).map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-lg border border-neutral-border p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-ink-900 text-xs font-bold text-brand-gold-500">{g.primerNombre[0]}{g.apellidoPaterno[0]}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.primerNombre} {g.apellidoPaterno}</p>
                <p className="text-xs text-neutral-text-muted">EPI {EPI_ZONE_LABELS[g.epi]} · {g.operationalStatus}</p>
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
