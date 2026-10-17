'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PatrullaModalidad } from '@/types/patrulla';
import type { RouteGroup } from '../lib/routeGroups';
import type { LatLng } from '../lib/routeGeometry';
import { calcularTrayecto, type RutaCalculada } from '../lib/routing';
import { calcularEta, distanciaRectaM, modoDeViaje, perfilDe, type Eta, type ModoViaje } from '../lib/eta';

// Trayecto de incorporación de cada guardia que todavía no llegó a su ruta o
// a su punto fijo: el camino más rápido por calles (el mismo ruteo de
// «Asignar ruta») y su tiempo estimado de llegada (lib/eta.ts). Reemplaza a
// la línea punteada que unía a los guardias de una misma unidad (16/10).
// Destino (pedido del usuario 16/10): el INICIO de la ruta — su primera
// calle, el primer punto que marcó el operador, porque el recorrido se hace
// en ese orden. En un punto fijo, el (sub)punto que le tocó.
//
// Para no saturar el servicio de ruteo (servidores públicos de OSRM):
//  · se recalcula solo si el guardia se movió > RECALCULAR_M, si pasó
//    RECALCULAR_MS o si cambió su destino;
//  · como mucho MAX_PARALELO pedidos a la vez;
//  · guardias del mismo vehículo (mismo destino, a pocos metros) comparten
//    la consulta: la clave redondea la posición.
// Entre recálculos el tiempo restante descuenta lo transcurrido, salvo que el
// guardia esté DETENIDO (no avanzó DETENIDO_M en DETENIDO_MS): ahí el tiempo
// no baja y se avisa. RETRASADO = pasó la hora pesimista calculada al inicio.

const RECALCULAR_M = 80;
const RECALCULAR_MS = 120_000;
const MAX_PARALELO = 2;
const DETENIDO_M = 25;
const DETENIDO_MS = 180_000;
const TICK_MS = 20_000;

export interface TrayectoIncorporacion {
  guardiaId: string;
  rutaId: string;
  color: string;
  destino: LatLng;
  path: LatLng[];
  distanciaM: number;
  siguioCalles: boolean;
  modo: ModoViaje;
  eta: Eta;
  /** Segundos que faltan (probable / pesimista), ya descontado lo transcurrido. */
  restanteS: number;
  restantePesimistaS: number;
  llegadaProbable: Date;
  llegadaPesimista: Date;
  detenido: boolean;
  /** Pasó la hora pesimista estimada al empezar a incorporarse. */
  retrasado: boolean;
}

interface Candidato {
  guardiaId: string;
  rutaId: string;
  color: string;
  origen: LatLng;
  destino: LatLng;
  modalidad: PatrullaModalidad | null;
}

interface Calculo {
  origen: LatLng;
  destino: LatLng;
  modo: ModoViaje;
  ruta: RutaCalculada;
  eta: Eta;
  calculadoEn: number;
}

function destinoDe(group: RouteGroup, m: RouteGroup['guards'][number]): LatLng | null {
  if (group.puntoFijo) return m.puntoAsignado ?? { lat: group.puntoFijo.lat, lng: group.puntoFijo.lng };
  return group.path[0] ?? m.puntoAsignado ?? null;
}

const redondeo = (v: number) => v.toFixed(4);
const claveConsulta = (o: LatLng, d: LatLng, modo: ModoViaje) => `${redondeo(o.lat)},${redondeo(o.lng)}>${redondeo(d.lat)},${redondeo(d.lng)}:${modo}`;

export function useTrayectosIncorporacion(routeGroups: RouteGroup[], activo = true): Map<string, TrayectoIncorporacion> {
  const candidatos = useMemo(() => {
    const lista: Candidato[] = [];
    if (!activo) return lista;
    for (const g of routeGroups) {
      for (const m of g.guards) {
        if (m.estadoRuta !== 'incorporandose' || m.lat == null || m.lng == null) continue;
        const destino = destinoDe(g, m);
        if (!destino) continue;
        lista.push({ guardiaId: m.guardiaId, rutaId: g.id, color: g.color, origen: { lat: m.lat, lng: m.lng }, destino, modalidad: g.ejecucion?.modalidad ?? null });
      }
    }
    return lista;
  }, [routeGroups, activo]);

  const calculos = useRef(new Map<string, Calculo>());
  const enCurso = useRef(new Map<string, Promise<RutaCalculada>>());
  const movimiento = useRef(new Map<string, { pos: LatLng; desde: number }>());
  const plazos = useRef(new Map<string, number>());
  const [version, setVersion] = useState(0);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (candidatos.length === 0) return;
    const iv = setInterval(() => setAhora(Date.now()), TICK_MS);
    return () => clearInterval(iv);
  }, [candidatos.length]);

  useEffect(() => {
    const vigentes = new Set(candidatos.map((c) => c.guardiaId));
    for (const mapa of [calculos.current, movimiento.current]) for (const id of Array.from(mapa.keys())) if (!vigentes.has(id)) mapa.delete(id);
    const plazosVigentes = new Set(candidatos.map((c) => `${c.guardiaId}:${c.rutaId}`));
    for (const k of Array.from(plazos.current.keys())) if (!plazosVigentes.has(k)) plazos.current.delete(k);

    const t = Date.now();
    for (const c of candidatos) {
      const mov = movimiento.current.get(c.guardiaId);
      if (!mov || distanciaRectaM(mov.pos, c.origen) > DETENIDO_M) movimiento.current.set(c.guardiaId, { pos: c.origen, desde: t });
    }

    const pendientes = candidatos.filter((c) => {
      const prev = calculos.current.get(c.guardiaId);
      if (!prev) return true;
      const otroDestino = distanciaRectaM(prev.destino, c.destino) > 5;
      return otroDestino || distanciaRectaM(prev.origen, c.origen) > RECALCULAR_M || t - prev.calculadoEn > RECALCULAR_MS;
    });
    if (pendientes.length === 0) return;

    let vigente = true;
    const cola = [...pendientes];
    const trabajar = async () => {
      while (vigente && cola.length > 0) {
        const c = cola.shift()!;
        const recta = distanciaRectaM(c.origen, c.destino);
        const modo = modoDeViaje(c.modalidad, recta);
        const clave = claveConsulta(c.origen, c.destino, modo);
        let promesa = enCurso.current.get(clave);
        if (!promesa) {
          promesa = calcularTrayecto(c.origen, c.destino, perfilDe(modo));
          enCurso.current.set(clave, promesa);
          void promesa.finally(() => enCurso.current.delete(clave));
        }
        const ruta = await promesa;
        if (!vigente) return;
        const fecha = new Date();
        const eta = calcularEta({ modo, distanciaM: ruta.distanciaM, duracionLibreS: ruta.duracionS, siguioCalles: ruta.siguioCalles, distanciaRectaM: recta, fecha });
        calculos.current.set(c.guardiaId, { origen: c.origen, destino: c.destino, modo, ruta, eta, calculadoEn: fecha.getTime() });
        const clavePlazo = `${c.guardiaId}:${c.rutaId}`;
        if (!plazos.current.has(clavePlazo)) plazos.current.set(clavePlazo, fecha.getTime() + eta.pesimistaS * 1000);
        setVersion((v) => v + 1);
      }
    };
    for (let i = 0; i < Math.min(MAX_PARALELO, cola.length); i += 1) void trabajar();
    return () => {
      vigente = false;
    };
  }, [candidatos]);

  return useMemo(() => {
    const out = new Map<string, TrayectoIncorporacion>();
    for (const c of candidatos) {
      const calc = calculos.current.get(c.guardiaId);
      if (!calc) continue;
      const mov = movimiento.current.get(c.guardiaId);
      const detenido = Boolean(mov && ahora - mov.desde > DETENIDO_MS);
      const transcurrido = detenido ? 0 : Math.max(0, (ahora - calc.calculadoEn) / 1000);
      const restanteS = Math.max(0, calc.eta.probableS - transcurrido);
      const restantePesimistaS = Math.max(restanteS, calc.eta.pesimistaS - transcurrido);
      const plazo = plazos.current.get(`${c.guardiaId}:${c.rutaId}`);
      out.set(c.guardiaId, {
        guardiaId: c.guardiaId,
        rutaId: c.rutaId,
        color: c.color,
        destino: c.destino,
        // El camino empieza donde está el guardia ahora (el cálculo puede ser de hace unos metros).
        path: calc.ruta.siguioCalles ? calc.ruta.path : [c.origen, c.destino],
        distanciaM: calc.ruta.siguioCalles ? calc.ruta.distanciaM : Math.round(distanciaRectaM(c.origen, c.destino)),
        siguioCalles: calc.ruta.siguioCalles,
        modo: calc.modo,
        eta: calc.eta,
        restanteS,
        restantePesimistaS,
        llegadaProbable: new Date(ahora + restanteS * 1000),
        llegadaPesimista: new Date(ahora + restantePesimistaS * 1000),
        detenido,
        retrasado: plazo != null && ahora > plazo,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` avisa que llegó un cálculo nuevo (vive en refs)
  }, [candidatos, ahora, version]);
}
