'use client';

// Catálogo EPI para componentes cliente (cambios/04 F1). Se carga UNA vez
// por sesión en el layout del grupo (dashboard) desde GET /api/epis y
// reemplaza a las listas fijas EPI_ZONES/EPI_ZONE_LABELS/EPI_ZONE_HEX: los
// nombres, colores y el orden oficial salen del backend (inventario de 6
// EPIs). Mientras carga, o si falla, los componentes muestran el código tal
// cual y el color neutro — nunca "Centro" por defecto.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getEpiCatalogo } from '@/lib/data-source';
import { colorEpi, nombreCortoEpi, nombreEpi, ordenarEpis, type EpiInfo, type EpiZone } from '@/types/epi';

interface EpiCatalogValue {
  /** Todas, en orden oficial (operativas N° 1–6 primero, luego históricas). */
  epis: EpiInfo[];
  /** Solo las que reciben rutas/usuarios/hechos nuevos — para selects de alta. */
  operativas: EpiInfo[];
  estado: 'cargando' | 'listo' | 'error';
  nombre: (codigo: EpiZone | null | undefined) => string;
  nombreCorto: (codigo: EpiZone | null | undefined) => string;
  color: (codigo: EpiZone | null | undefined) => string;
  recargar: () => void;
}

const EpiCatalogContext = createContext<EpiCatalogValue | null>(null);

export function EpiCatalogProvider({ children, inicial }: { children: ReactNode; inicial?: EpiInfo[] }) {
  const [epis, setEpis] = useState<EpiInfo[]>(() => ordenarEpis(inicial ?? []));
  const [estado, setEstado] = useState<EpiCatalogValue['estado']>(inicial ? 'listo' : 'cargando');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    getEpiCatalogo()
      .then((data) => {
        if (!vivo) return;
        setEpis(ordenarEpis(data));
        setEstado('listo');
      })
      .catch(() => {
        if (vivo) setEstado('error');
      });
    return () => {
      vivo = false;
    };
  }, [intento]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  const value = useMemo<EpiCatalogValue>(
    () => ({
      epis,
      operativas: epis.filter((e) => e.operativa),
      estado,
      nombre: (c) => nombreEpi(epis, c),
      nombreCorto: (c) => nombreCortoEpi(epis, c),
      color: (c) => colorEpi(epis, c),
      recargar,
    }),
    [epis, estado, recargar],
  );

  return <EpiCatalogContext.Provider value={value}>{children}</EpiCatalogContext.Provider>;
}

export function useEpiCatalogo(): EpiCatalogValue {
  const ctx = useContext(EpiCatalogContext);
  if (!ctx) throw new Error('useEpiCatalogo() requiere <EpiCatalogProvider> (layout del dashboard).');
  return ctx;
}
