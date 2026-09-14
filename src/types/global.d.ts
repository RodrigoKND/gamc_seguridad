// @types/leaflet.markercluster amplía el namespace `leaflet` (declare
// module "leaflet" { class MarkerCluster ... }) pero con
// moduleResolution:"bundler" no se incluye solo por estar en
// node_modules/@types — hace falta esta referencia explícita para que
// `L.MarkerCluster`/`MarkerClusterGroupOptions` (usados en PatrolLayer.tsx
// vía react-leaflet-cluster) tengan tipo. Debe ir antes que cualquier otra
// declaración del archivo — TypeScript solo respeta un triple-slash
// reference si está al principio.
/// <reference types="leaflet.markercluster" />

// Declaración ambiental para imports de efecto secundario de CSS
// (p. ej. `import './globals.css'` en src/app/layout.tsx). Necesaria desde
// TypeScript 6.0 (diagnóstico TS2882) — MASTER.md sección 1.
declare module '*.css';
