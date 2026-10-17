'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PatrullaModalidad } from '@/types/patrulla';
import { puntoPermitido, trazadoPermitido, type Jurisdiccion } from '../lib/jurisdiccion';
import { calcularRutaPorCalles } from '../lib/routing';
import type { LatLng } from '../lib/routeGeometry';

export const MAX_PUNTOS = 5;
export const MIN_PUNTOS = 2;

// Estado del trazado que el usuario dibuja con clics (2 a 5 puntos, en
// orden). El camino real por calles se calcula solo (pedido 2026-09-14:
// "debe ir por las calles... siempre debe cerrar el circuito si hay 3 o
// más puntos"). Lo comparten "Asignar Ruta" y "Crear Ruta".

export interface TrazadoRuta {
  puntos: LatLng[];
  /** Trazado listo para usar: el ruteado por calles, o la línea recta mientras se calcula. */
  path: LatLng[];
  calculando: boolean;
  /** false si OSRM no respondió y `path` es la aproximación en línea recta. */
  siguioCalles: boolean;
  fueraDeEpi: boolean;
  /** Hay trazado completo, calculado y dentro de la jurisdicción. */
  listo: boolean;
  /** Agrega un punto; devuelve un mensaje si no se pudo (fuera de la EPI, máximo alcanzado). */
  agregar: (p: LatLng) => string | null;
  deshacer: () => void;
  reiniciar: () => void;
}

export function useTrazadoRuta(modalidad: PatrullaModalidad | null, jurisdiccion: Jurisdiccion | null, activo = true): TrazadoRuta {
  const [puntos, setPuntos] = useState<LatLng[]>([]);
  const [calculada, setCalculada] = useState<{ base: LatLng[]; path: LatLng[]; siguioCalles: boolean } | null>(null);

  useEffect(() => {
    if (!activo || puntos.length < MIN_PUNTOS) {
      setCalculada(null);
      return;
    }
    // `vigente` descarta la respuesta si los puntos cambiaron antes de que
    // OSRM conteste (no pisar un cálculo nuevo con uno viejo más lento).
    let vigente = true;
    calcularRutaPorCalles(puntos, puntos.length >= 3, modalidad ?? 'coche').then((r) => {
      if (vigente) setCalculada({ base: puntos, path: r.path, siguioCalles: r.siguioCalles });
    });
    return () => {
      vigente = false;
    };
  }, [activo, puntos, modalidad]);

  // El cálculo solo vale para los puntos con los que se pidió: si ya
  // cambiaron, todavía se está calculando (antes se podía confirmar la línea
  // recta provisoria si se apuraba el "Siguiente").
  const vigente = calculada && calculada.base === puntos ? calculada : null;
  const calculando = activo && puntos.length >= MIN_PUNTOS && !vigente;
  const path = useMemo(() => vigente?.path ?? puntos, [vigente, puntos]);
  const fueraDeEpi = useMemo(() => path.length >= 2 && !trazadoPermitido(jurisdiccion, path), [path, jurisdiccion]);

  const agregar = useCallback(
    (p: LatLng): string | null => {
      if (puntos.length >= MAX_PUNTOS) return `Máximo ${MAX_PUNTOS} puntos. Deshaz uno para cambiarlo.`;
      if (!puntoPermitido(jurisdiccion, p)) return 'fuera_de_epi';
      setPuntos((prev) => [...prev, { lat: p.lat, lng: p.lng }]);
      return null;
    },
    [puntos.length, jurisdiccion],
  );
  const deshacer = useCallback(() => setPuntos((prev) => prev.slice(0, -1)), []);
  const reiniciar = useCallback(() => setPuntos([]), []);

  return {
    puntos,
    path,
    calculando,
    siguioCalles: vigente?.siguioCalles ?? true,
    fueraDeEpi,
    listo: puntos.length >= MIN_PUNTOS && !calculando && !fueraDeEpi,
    agregar,
    deshacer,
    reiniciar,
  };
}
