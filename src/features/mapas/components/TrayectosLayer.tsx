'use client';

import { Fragment, memo } from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import { ESTILO_INCORPORACION, PANES, ZOOM } from '../lib/capas';
import { MODO_ETIQUETA, formatoDuracion, formatoHora } from '../lib/eta';
import type { TrayectoIncorporacion } from '../hooks/useTrayectosIncorporacion';
import { useZoomMapa } from './MapPanes';

// Camino más rápido por calles de cada guardia que se está incorporando,
// hasta su punto de la ruta o su punto fijo (16/10). Reemplaza a la línea
// punteada que unía a los guardias de una misma unidad. Siempre roja y
// discontinua (ESTILO_INCORPORACION, pedido del usuario 16/10), por debajo
// de la ruta (capas.ts), para que no se confunda con el trazado.

export interface TrayectosLayerProps {
  trayectos: Map<string, TrayectoIncorporacion>;
  nombres: Map<string, string>;
}

export const TrayectosLayer = memo(function TrayectosLayer({ trayectos, nombres }: TrayectosLayerProps) {
  const zoom = useZoomMapa();
  if (zoom < ZOOM.trayectos) return null;
  return (
    <>
      {Array.from(trayectos.values()).map((t) => {
        if (t.path.length < 2) return null;
        const posiciones = t.path.map((p) => [p.lat, p.lng] as [number, number]);
        return (
          <Fragment key={t.guardiaId}>
            <Polyline positions={posiciones} pane={PANES.trayectos.name} pathOptions={ESTILO_INCORPORACION}>
              <Tooltip sticky>
                {`${nombres.get(t.guardiaId) ?? 'Guardia'} · ${MODO_ETIQUETA[t.modo]} · llega en ~${formatoDuracion(t.restanteS)} (${formatoHora(t.llegadaProbable)})`}
                {t.detenido ? ' · detenido' : t.retrasado ? ' · retrasado' : ''}
              </Tooltip>
            </Polyline>
          </Fragment>
        );
      })}
    </>
  );
});
