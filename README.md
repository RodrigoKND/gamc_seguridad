# Plataforma Web · Seguridad Ciudadana GAMC

**Gobierno Autónomo Municipal de Cochabamba — Dirección de Seguridad Ciudadana**

![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js) ![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_CSS-3.3-06B6D4?logo=tailwindcss&logoColor=white) ![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet&logoColor=white) ![Lucide](https://img.shields.io/badge/Iconos-Lucide-8B5CF6)

Plataforma web para la reingeniería de la Dirección de Seguridad Ciudadana del GAMC 
(Cochabamba, Bolivia).

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + TypeScript (strict) |
| Estilos | Tailwind CSS 3 |
| Mapas GIS | Leaflet + React-Leaflet + `react-leaflet-cluster` |
| Tiempo real | Socket.IO client |
| Autenticación | JWT (`jose`) |
| Iconografía | Lucide React |
| Tipografía | IBM Plex Sans |
| Backend | API REST propia (`gamc-api`, Express + PostgreSQL) — documentación en `unificacion/` (carpeta local, no versionada, ver `.gitignore`) |

Estado de integración: **Guardias, Usuarios y Dashboard** ya consumen el backend real vía `src/lib/api/`. **Mapas y Hechos** siguen sobre datos simulados en `src/lib/data-source.ts` mientras se completa esa integración.

---

## Paleta de colores

### Paleta principal

| | Token | Hex |
|---|---|---|
| ![#0D0D0E](https://img.shields.io/badge/-%20-0D0D0E?style=flat-square) | `brand-ink-950` | `#0D0D0E` |
| ![#1A1A1A](https://img.shields.io/badge/-%20-1A1A1A?style=flat-square) | `brand-ink-900` | `#1A1A1A` |
| ![#262624](https://img.shields.io/badge/-%20-262624?style=flat-square) | `brand-ink-800` | `#262624` |
| ![#3D3A35](https://img.shields.io/badge/-%20-3D3A35?style=flat-square) | `brand-ink-700` | `#3D3A35` |
| ![#C59B6D](https://img.shields.io/badge/-%20-C59B6D?style=flat-square) | `brand-gold-500` | `#C59B6D` |
| ![#A97F52](https://img.shields.io/badge/-%20-A97F52?style=flat-square) | `brand-gold-600` | `#A97F52` |
| ![#8C6740](https://img.shields.io/badge/-%20-8C6740?style=flat-square) | `brand-gold-700` | `#8C6740` |
| ![#DDBE97](https://img.shields.io/badge/-%20-DDBE97?style=flat-square) | `brand-gold-300` | `#DDBE97` |
| ![#F3E7D8](https://img.shields.io/badge/-%20-F3E7D8?style=flat-square) | `brand-gold-100` | `#F3E7D8` |

### Semántica de riesgo

| | Token | Hex |
|---|---|---|
| ![#DC2626](https://img.shields.io/badge/-%20-DC2626?style=flat-square) | `risk-critical` | `#DC2626` |
| ![#F97316](https://img.shields.io/badge/-%20-F97316?style=flat-square) | `risk-high` | `#F97316` |
| ![#EAB308](https://img.shields.io/badge/-%20-EAB308?style=flat-square) | `risk-medium` | `#EAB308` |
| ![#22C55E](https://img.shields.io/badge/-%20-22C55E?style=flat-square) | `risk-low` | `#22C55E` |


### Neutrales

| | Token | Hex |
|---|---|---|
| ![#F5F7FA](https://img.shields.io/badge/-%20-F5F7FA?style=flat-square) | `neutral-bg` | `#F5F7FA` |
| ![#E5E7EB](https://img.shields.io/badge/-%20-E5E7EB?style=flat-square) | `neutral-border` | `#E5E7EB` |
| ![#1F2937](https://img.shields.io/badge/-%20-1F2937?style=flat-square) | `neutral-text` | `#1F2937` |
| ![#6B7280](https://img.shields.io/badge/-%20-6B7280?style=flat-square) | `neutral-text-muted` | `#6B7280` |

Todos los tokens viven en `tailwind.config.js` — usar siempre la clase Tailwind (`bg-brand-ink-900`, `text-risk-critical`, etc.), nunca un hex suelto en un componente.

---

## Estructura del proyecto

```
src/
├── app/                 # App Router — rutas (auth)/(dashboard), layouts, globals.css
├── features/            # 1 módulo funcional = 1 carpeta (auth, dashboard, guardias, hechos, mapas, reportes)
│   └── <módulo>/
│       ├── actions/     # Server Actions ('use server')
│       ├── components/
│       └── types.ts
├── components/          # UI y layout compartidos entre módulos
├── lib/
│   ├── api/             # Cliente HTTP/WebSocket contra el backend real
│   ├── data-source.ts   # Adaptador con datos simulados (Mapas y Hechos, ver arriba)
│   ├── auth-session*.ts # Sesión (cookie + verificación JWT)
│   └── permissions.ts   # RBAC — matriz de escritura por rol
├── middleware.ts        # Protección de rutas por rol
└── types/                # Tipos alineados con el esquema de la base de datos

design/                  # Mockups y referencias visuales
unificacion/             # Documentación del backend (API, base de datos)
```

---

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar con los valores del backend
npm run dev                  # http://localhost:3000
```

Variables de entorno (`.env.example`): URL del backend (`NEXT_PUBLIC_API_BASE_URL`), WebSocket (`NEXT_PUBLIC_WEBSOCKET_URL`), configuración del mapa base, y `JWT_SECRET` — debe ser idéntico al del backend.

### Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run typecheck` | Verificación de tipos (TypeScript strict) |
| `npm run lint` | ESLint |

Gestor de paquetes: **npm** (no mezclar con `pnpm`/`yarn`, hay `package-lock.json` comiteado).


