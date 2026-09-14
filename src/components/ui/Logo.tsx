'use client';

import { useState } from 'react';
import { Shield } from 'lucide-react';

// Logo institucional (design/mockups/Logo_Escudo.png -> public/, actualizado
// 2026-09-06 — reemplaza el Escudo_de_Cochabamba.svg anterior; paleta nueva
// en MASTER.md sección 4).
// Marca institucional compartida entre Sidebar y Login (MASTER.md sección 6:
// un asset usado en 2+ lugares no se duplica). Ancho/alto explícitos para no
// generar layout shift mientras carga (perf: image-dimension).
//
// El SVG original (export de Inkscape) pesaba 1.8MB — incluso optimizado
// con svgo bajaba solo a ~546KB, porque el peso viene de la cantidad de
// nodos de la ilustración (corona, banderas, castillos), no de metadata.
// Seguía fallando a renderizar de forma intermitente en el login (el
// navegador tarda en parsear/rasterizar un SVG así de complejo a 24-44px,
// y a veces se rinde). Se rasterizó una sola vez a PNG a 176px con resvg
// (~56KB) — a un tamaño fijo tan chico, un raster decodifica instantáneo
// y sin ese riesgo; ya no hace falta que sea vectorial. `object-contain`
// evita que se estire (el PNG no es cuadrado); `onError` cae a un ícono de
// escudo genérico si el archivo llegara a fallar por cualquier otro
// motivo, en vez de mostrar el ícono de imagen rota del navegador.

export interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = '', size = 24 }: LogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <Shield
        className={className}
        style={{ width: size, height: size }}
        aria-label="Escudo del Gobierno Autónomo Municipal de Cochabamba"
      />
    );
  }

  return (
    <img
      src="/escudo-cochabamba.png"
      alt="Escudo del Gobierno Autónomo Municipal de Cochabamba"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={['object-contain', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    />
  );
}
