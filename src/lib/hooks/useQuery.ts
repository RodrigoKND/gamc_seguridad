'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Lectura de datos con "stale-while-revalidate": al entrar a una pantalla ya
// visitada se pinta al instante lo último que se vio y se refresca por detrás.
// - Una sola petición en vuelo por clave (varios componentes/eventos que piden
//   lo mismo comparten el resultado).
// - El sondeo se pausa con la pestaña oculta y se refresca al volver a ella.
// - La caché vive en memoria del navegador: iniciar/cerrar sesión recarga la
//   página de verdad, así que nunca se mezclan datos de usuarios distintos.

interface CacheEntry {
  data: unknown;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

function fetchShared<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

export type QueryStatus = 'loading' | 'ready' | 'error';

export interface QueryOptions {
  /** Sondeo de respaldo en ms (solo con la pestaña visible). */
  refreshMs?: number;
}

export interface QueryResult<T> {
  data: T | undefined;
  status: QueryStatus;
  /** Vuelve a pedir los datos (comparte la petición si ya hay una en vuelo). */
  refetch: () => Promise<void>;
}

export function useQuery<T>(key: string, fetcher: () => Promise<T>, { refreshMs }: QueryOptions = {}): QueryResult<T> {
  const [data, setData] = useState<T | undefined>(() => cache.get(key)?.data as T | undefined);
  const [status, setStatus] = useState<QueryStatus>(() => (cache.has(key) ? 'ready' : 'loading'));
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const next = await fetchShared(key, () => fetcherRef.current());
      if (!mountedRef.current) return;
      setData(next);
      setStatus('ready');
    } catch {
      // Con datos previos en pantalla un fallo puntual no los borra.
      if (mountedRef.current) setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, [key]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = refreshMs
      ? setInterval(() => {
          if (document.visibilityState === 'visible') void refetch();
        }, refreshMs)
      : null;

    return () => {
      mountedRef.current = false;
      document.removeEventListener('visibilitychange', onVisible);
      if (interval) clearInterval(interval);
    };
  }, [refetch, refreshMs]);

  return { data, status, refetch };
}
