'use client';

import { useMemo, useState } from 'react';
import { BatteryLow, BatteryMedium, Check, ChevronDown, ChevronRight, Radio, Route, Users, X } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { LiveRelativeTime } from '@/components/ui/LiveRelativeTime';
import { EPI_ZONE_LABELS } from '@/types/epi';
import { OPERATIONAL_STATUS_BADGE_CLASS, OPERATIONAL_STATUS_LABELS } from '@/features/guardias/types';
import type { RouteGroup } from '../lib/routeGroups';
import type { GuardMarker } from '../types';

// Bandeja de información del Mapa de Patrullaje — antes el único acceso a
// datos era hacer clic en un pin de a uno (MASTER.md sección 7.3 solo
// pedía el drawer). En dashboards de flotas en vivo (fleet tracking) el
// patrón estándar es mapa + panel lateral con el roster completo.
//
// Rediseño 2026-09-14 (pedido explícito, "el modo que tiene el LoL para
// segmentar los amigos"): en vez de una lista plana, el panel se segmenta
// en secciones tipo grupos de amigos —
//   · Emergencia — SOS activo, fija arriba de todo, sin poder colapsarse
//     (tiene prioridad, nunca se puede perder de vista por error).
//   · General — guardias sin ruta asignada. Estándar, siempre existe.
//   · Una sección por cada ruta activa, coloreada igual que su línea en
//     el mapa (RouteLinesLayer) — dinámica, aparece/desaparece con las
//     rutas reales.
// "Ninguna ruta estándar puede eliminarse" (Emergencia/General no tienen
// botón de cancelar — no son rutas, son clasificaciones fijas). Las
// secciones de ruta sí: cancelar TODA la ruta (todos los guardias) o solo
// UN guardia de esa ruta sin tocar a los demás.
//
// Un guardia en emergencia SIEMPRE aparece en la sección Emergencia,
// incluso si tiene una ruta asignada — se saca de la sección de su ruta
// mientras dure el SOS (prioridad), pero su fila `patrulla` sigue intacta:
// vuelve a aparecer en la ruta en cuanto se resuelve la alerta.

function batteryIcon(bateria: number) {
  return bateria <= 25 ? BatteryLow : BatteryMedium;
}

function guardRowClasses(isSelected: boolean, isSos: boolean) {
  if (isSos) {
    // Pedido explícito: el banner de un guardia en Emergencia debe ser rojo
    // y bien visual (no solo un borde fino) — mismo criterio que el header
    // del TelemetryDrawer (bg-risk-critical + animate-pulse-emergency).
    return [
      'flex w-full items-start gap-2.5 border-l-[3px] border-risk-critical bg-risk-critical py-2.5 pl-3 pr-2 text-left text-white',
      'transition-colors duration-200 animate-pulse-emergency motion-reduce:animate-none',
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2',
    ].join(' ');
  }
  return [
    'flex w-full items-start gap-2.5 py-2.5 pl-3 pr-2 text-left transition-colors duration-200',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2',
    isSelected ? 'bg-brand-gold-600/5' : 'hover:bg-neutral-bg',
    'border-l-[3px] border-transparent',
  ].join(' ');
}

interface GuardRowProps {
  guard: GuardMarker;
  isSelected: boolean;
  onSelect: (guard: GuardMarker) => void;
  onExpandFoto: (foto: { src: string; alt: string }) => void;
  /** Si viene, muestra el botón de sacar a ESTE guardia de su ruta (X chica, confirmación en 2 pasos). */
  onRemoveFromRoute?: () => void;
  removing?: boolean;
  confirming?: boolean;
  onStartConfirm?: () => void;
  onCancelConfirm?: () => void;
}

function GuardRow({ guard, isSelected, onSelect, onExpandFoto, onRemoveFromRoute, removing, confirming, onStartConfirm, onCancelConfirm }: GuardRowProps) {
  // `hasSos` (no `operationalStatus === 'emergencia'`) es la fuente de
  // verdad real de SOS — mismo criterio que las secciones de arriba y que
  // el pin del mapa/TelemetryDrawer (bug 2026-09-13).
  const isSos = guard.hasSos === true;
  const BatteryIcon = batteryIcon(guard.bateria);

  return (
    <div className={guardRowClasses(isSelected, isSos)}>
      {guard.fotoUrl ? (
        <button
          type="button"
          onClick={() => onExpandFoto({ src: guard.fotoUrl!, alt: `Foto de ${guard.nombre}` })}
          aria-label={`Ampliar foto de ${guard.nombre}`}
          className={[
            'shrink-0 overflow-hidden rounded-full transition-opacity duration-200 hover:opacity-80 focus:outline-none focus-visible:ring-2',
            isSos ? 'ring-2 ring-white focus-visible:ring-white' : 'focus-visible:ring-brand-gold-600',
          ].join(' ')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- foto remota del backend */}
          <img src={guard.fotoUrl} alt="" className="h-8 w-8 object-cover" />
        </button>
      ) : (
        <span
          className={[
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
            isSos ? 'bg-white/15 text-white ring-2 ring-white' : 'bg-brand-ink-900 text-brand-gold-500',
          ].join(' ')}
        >
          {guard.label}
        </span>
      )}
      <button type="button" onClick={() => onSelect(guard)} aria-current={isSelected || undefined} className="flex min-w-0 flex-1 items-start text-left">
        <div className="min-w-0 flex-1">
          <p className={['truncate text-[12.5px] font-semibold', isSos ? 'text-white' : 'text-neutral-text'].join(' ')}>{guard.nombre}</p>
          <p className={['truncate text-[11px]', isSos ? 'text-white/80' : 'text-neutral-text-muted'].join(' ')}>
            EPI {EPI_ZONE_LABELS[guard.zone]} · {guard.ubicacionActual}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={[
                'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold',
                isSos ? 'bg-white/15 text-white' : OPERATIONAL_STATUS_BADGE_CLASS[guard.operationalStatus],
              ].join(' ')}
            >
              {OPERATIONAL_STATUS_LABELS[guard.operationalStatus]}
            </span>
            <span className={['flex items-center gap-0.5 text-[10.5px]', isSos ? 'text-white/80' : 'text-neutral-text-muted'].join(' ')}>
              <BatteryIcon className="h-3 w-3" aria-hidden="true" />
              {guard.bateria}%
            </span>
            <span className={['flex items-center gap-0.5 text-[10.5px]', isSos ? 'text-white/80' : 'text-neutral-text-muted'].join(' ')}>
              <Radio className="h-3 w-3" aria-hidden="true" />
              <LiveRelativeTime iso={guard.capturadoEnIso} fallback={guard.ultimoSync} />
            </span>
          </div>
        </div>
      </button>

      {onRemoveFromRoute && (
        <div className="flex shrink-0 items-center gap-1 pt-1">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={onRemoveFromRoute}
                disabled={removing}
                aria-label={`Confirmar sacar a ${guard.nombre} de la ruta`}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-risk-critical text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onCancelConfirm}
                disabled={removing}
                aria-label="No sacar de la ruta"
                className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-border text-neutral-text-muted transition-colors duration-200 hover:bg-neutral-bg disabled:opacity-50"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStartConfirm}
              aria-label={`Sacar a ${guard.nombre} de la ruta`}
              className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-text-muted transition-colors duration-200 hover:bg-risk-critical/10 hover:text-risk-critical focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export interface PatrolRosterPanelProps {
  guards: GuardMarker[];
  selectedId: string | null;
  onSelect: (guard: GuardMarker) => void;
  /** Rutas activas agrupadas (routeGroups.ts) — una sección por ruta. */
  routeGroups?: RouteGroup[];
  /** Cancela TODA la ruta (todos los guardias vigentes en ella). */
  onCancelRoute?: (rutaPlantillaId: string) => Promise<boolean>;
  /** Saca a UN guardia de su ruta sin tocar a los demás (patrullaId = fila propia de ese guardia). */
  onCancelGuardFromRoute?: (patrullaId: string) => Promise<boolean>;
}

export function PatrolRosterPanel({
  guards,
  selectedId,
  onSelect,
  routeGroups = [],
  onCancelRoute,
  onCancelGuardFromRoute,
}: PatrolRosterPanelProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [fotoExpandida, setFotoExpandida] = useState<{ src: string; alt: string } | null>(null);
  const [confirmingRouteId, setConfirmingRouteId] = useState<string | null>(null);
  const [cancellingRouteId, setCancellingRouteId] = useState<string | null>(null);
  const [confirmingPatrullaId, setConfirmingPatrullaId] = useState<string | null>(null);
  const [cancellingPatrullaId, setCancellingPatrullaId] = useState<string | null>(null);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirmCancelRoute(rutaId: string) {
    if (!onCancelRoute) return;
    setCancellingRouteId(rutaId);
    const ok = await onCancelRoute(rutaId);
    setCancellingRouteId(null);
    if (ok) setConfirmingRouteId(null);
  }

  async function handleConfirmRemoveGuard(patrullaId: string) {
    if (!onCancelGuardFromRoute) return;
    setCancellingPatrullaId(patrullaId);
    const ok = await onCancelGuardFromRoute(patrullaId);
    setCancellingPatrullaId(null);
    if (ok) setConfirmingPatrullaId(null);
  }

  const guardById = useMemo(() => new Map(guards.map((g) => [g.id, g])), [guards]);
  // `hasSos` (no `operationalStatus === 'emergencia'`) es la fuente de verdad
  // real de SOS — igual que el pin del mapa (PatrolLayer) y el drawer
  // (TelemetryDrawer, bug 2026-09-13). Un guardia puede tener `esSos=true`
  // en su última telemetría con `estadoOperativo` desincronizado a otra
  // cosa (ej. 'fuera_de_servicio'); si esta sección solo mirara
  // `operationalStatus`, ese guardia nunca aparecería en Emergencia y
  // tampoco se excluiría de General — quedaría invisible para resolver el SOS.
  const emergenciaGuards = useMemo(() => guards.filter((g) => g.hasSos), [guards]);
  const emergenciaIds = useMemo(() => new Set(emergenciaGuards.map((g) => g.id)), [emergenciaGuards]);

  // Cada sección de ruta lista a sus miembros EXCEPTO los que están en
  // emergencia ahora mismo (se ven arriba, en Emergencia — prioridad). La
  // fila `patrulla` sigue intacta, esto es solo dónde se muestran.
  const routeSections = useMemo(
    () =>
      routeGroups.map((route) => ({
        route,
        members: route.guards
          .filter((m) => !emergenciaIds.has(m.guardiaId))
          .map((m) => ({ ...m, guard: guardById.get(m.guardiaId) }))
          .filter((m): m is typeof m & { guard: GuardMarker } => Boolean(m.guard))
          .sort((a, b) => a.guard.nombre.localeCompare(b.guard.nombre)),
      })),
    [routeGroups, emergenciaIds, guardById],
  );

  const routedGuardIds = useMemo(() => new Set(routeGroups.flatMap((r) => r.guards.map((m) => m.guardiaId))), [routeGroups]);
  const generalGuards = useMemo(
    () =>
      guards
        .filter((g) => !g.hasSos && !routedGuardIds.has(g.id))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [guards, routedGuardIds],
  );

  return (
    <div className="flex h-full flex-col">
      <ImageLightbox
        src={fotoExpandida?.src ?? null}
        alt={fotoExpandida?.alt ?? ''}
        onClose={() => setFotoExpandida(null)}
      />
      <div className="flex items-center justify-between border-b border-neutral-border px-4 py-3">
        <div>
          <p className="text-sm font-bold text-brand-ink-900">Guardias en Patrullaje</p>
          <p className="text-xs text-neutral-text-muted">{guards.length} en el mapa</p>
        </div>
      </div>

      {guards.length === 0 ? (
        <div className="p-3">
          <EmptyState icon={Users} title="Sin guardias patrullando en este momento." className="border-none" />
        </div>
      ) : (
        <div className="scrollbar-hidden flex-1 overflow-y-auto">
          {/* Emergencia — fija arriba, sin colapsar, sin botón de eliminar (no es una ruta). */}
          {emergenciaGuards.length > 0 && (
            <div className="border-b border-neutral-border">
              <div className="flex items-center gap-1.5 bg-risk-critical/5 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-risk-critical">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-risk-critical motion-reduce:animate-none" aria-hidden="true" />
                Emergencia ({emergenciaGuards.length})
              </div>
              <div className="divide-y divide-neutral-bg">
                {emergenciaGuards.map((guard) => (
                  <GuardRow key={guard.id} guard={guard} isSelected={guard.id === selectedId} onSelect={onSelect} onExpandFoto={setFotoExpandida} />
                ))}
              </div>
            </div>
          )}

          {/* Una sección colapsable por ruta activa. */}
          {routeSections.map(({ route, members }) => {
            const isCollapsed = collapsed.has(route.id);
            const isConfirmingRoute = confirmingRouteId === route.id;
            const isCancellingRoute = cancellingRouteId === route.id;
            return (
              <div key={route.id} className="border-b border-neutral-border">
                <div className="flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-neutral-text">
                  <button type="button" onClick={() => toggleCollapsed(route.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: route.color }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate normal-case">{route.nombre}</span>
                    <span className="shrink-0 text-[10.5px] font-semibold text-neutral-text-muted">({route.guards.length})</span>
                  </button>
                  {onCancelRoute &&
                    (isConfirmingRoute ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="text-[10.5px] font-normal normal-case text-neutral-text-muted">¿Cancelar?</span>
                        <button
                          type="button"
                          onClick={() => handleConfirmCancelRoute(route.id)}
                          disabled={isCancellingRoute}
                          aria-label={`Confirmar cancelación de la ruta ${route.nombre}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-risk-critical text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-50"
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingRouteId(null)}
                          disabled={isCancellingRoute}
                          aria-label="No cancelar"
                          className="flex h-5 w-5 items-center justify-center rounded-full border border-neutral-border text-neutral-text-muted transition-colors duration-200 hover:bg-neutral-bg disabled:opacity-50"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingRouteId(route.id)}
                        aria-label={`Cancelar la ruta ${route.nombre}`}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-neutral-text-muted transition-colors duration-200 hover:bg-risk-critical/10 hover:text-risk-critical focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ))}
                </div>
                {!isCollapsed && (
                  <div className="divide-y divide-neutral-bg">
                    {members.length === 0 ? (
                      <p className="px-4 py-2.5 text-[11.5px] text-neutral-text-muted">Los guardias de esta ruta están en Emergencia.</p>
                    ) : (
                      members.map(({ patrullaId, guard }) => (
                        <GuardRow
                          key={guard.id}
                          guard={guard}
                          isSelected={guard.id === selectedId}
                          onSelect={onSelect}
                          onExpandFoto={setFotoExpandida}
                          onRemoveFromRoute={onCancelGuardFromRoute ? () => handleConfirmRemoveGuard(patrullaId) : undefined}
                          removing={cancellingPatrullaId === patrullaId}
                          confirming={confirmingPatrullaId === patrullaId}
                          onStartConfirm={() => setConfirmingPatrullaId(patrullaId)}
                          onCancelConfirm={() => setConfirmingPatrullaId(null)}
                        />
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* General — guardias sin ruta asignada. Estándar, siempre existe, no se puede eliminar. */}
          <div>
            <button
              type="button"
              onClick={() => toggleCollapsed('general')}
              className="flex w-full items-center gap-1.5 px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-neutral-text-muted"
            >
              {collapsed.has('general') ? <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              <Route className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="flex-1 normal-case">General</span>
              <span className="shrink-0 text-[10.5px] font-semibold">({generalGuards.length})</span>
            </button>
            {!collapsed.has('general') && (
              <div className="divide-y divide-neutral-bg">
                {generalGuards.length === 0 ? (
                  <p className="px-4 py-2.5 text-[11.5px] text-neutral-text-muted">Todos los guardias tienen una ruta asignada.</p>
                ) : (
                  generalGuards.map((guard) => (
                    <GuardRow key={guard.id} guard={guard} isSelected={guard.id === selectedId} onSelect={onSelect} onExpandFoto={setFotoExpandida} />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
