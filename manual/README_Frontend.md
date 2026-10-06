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

### Paleta principal — Innova / app móvil

Idéntica a la app móvil de guardias (`appmunicipal/src/theme/colors.ts`), en la línea visual de la plataforma municipal [Innova](https://innova.cochabamba.bo). El logo (escudo negro + bronce) se mantiene sin cambios. Roles, reglas y tabla de contraste en `MASTER.md` sección 4.

| | Token | Hex | Uso |
|---|---|---|---|
| ![#4D3B86](https://img.shields.io/badge/-%20-4D3B86?style=flat-square) | `primary-900` | `#4D3B86` | Títulos, botón `brand` |
| ![#5A4794](https://img.shields.io/badge/-%20-5A4794?style=flat-square) | `primary-800` | `#5A4794` | Links, íconos de Topbar |
| ![#6B559F](https://img.shields.io/badge/-%20-6B559F?style=flat-square) | `primary-700` | `#6B559F` | Sidebar, panel de login, botón `primary`, foco, avatares |
| ![#8C78BF](https://img.shields.io/badge/-%20-8C78BF?style=flat-square) | `primary-500` | `#8C78BF` | Rampas de gráficos |
| ![#E1D9F2](https://img.shields.io/badge/-%20-E1D9F2?style=flat-square) | `primary-200` | `#E1D9F2` | Anillo de íconos, gridlines |
| ![#EFEAF8](https://img.shields.io/badge/-%20-EFEAF8?style=flat-square) | `primary-100` | `#EFEAF8` | Círculo de íconos, filas seleccionadas |
| ![#F5F2FA](https://img.shields.io/badge/-%20-F5F2FA?style=flat-square) | `primary-50` | `#F5F2FA` | Hover sutil, cajas informativas |
| ![#C2335D](https://img.shields.io/badge/-%20-C2335D?style=flat-square) | `accent-600` | `#C2335D` | Ítem/tab activo, flecha de KPI |
| ![#E8567F](https://img.shields.io/badge/-%20-E8567F?style=flat-square) | `accent-500` | `#E8567F` | Acento no-texto: "?" del saludo, borde de avatar, selección |
| ![#F28BA6](https://img.shields.io/badge/-%20-F28BA6?style=flat-square) | `accent-300` | `#F28BA6` | Detalle del divisor del login |

Íconos con contenedor y avatares usan las clases compartidas `.icon-badge` y `.avatar-initials` (`src/app/globals.css`).

### Semántica de riesgo

| | Token | Hex |
|---|---|---|
| ![#DC2626](https://img.shields.io/badge/-%20-DC2626?style=flat-square) | `risk-critical` | `#DC2626` |
| ![#F97316](https://img.shields.io/badge/-%20-F97316?style=flat-square) | `risk-high` | `#F97316` |
| ![#EAB308](https://img.shields.io/badge/-%20-EAB308?style=flat-square) | `risk-medium` | `#EAB308` |
| ![#22C55E](https://img.shields.io/badge/-%20-22C55E?style=flat-square) | `risk-low` | `#22C55E` |


### Neutrales — tintados en lila

| | Token | Hex |
|---|---|---|
| ![#F5F2FA](https://img.shields.io/badge/-%20-F5F2FA?style=flat-square) | `neutral-bg` | `#F5F2FA` |
| ![#DDD6EC](https://img.shields.io/badge/-%20-DDD6EC?style=flat-square) | `neutral-border` | `#DDD6EC` |
| ![#1F1A2E](https://img.shields.io/badge/-%20-1F1A2E?style=flat-square) | `neutral-text` | `#1F1A2E` |
| ![#6B6880](https://img.shields.io/badge/-%20-6B6880?style=flat-square) | `neutral-text-muted` | `#6B6880` |

Todos los tokens viven en `tailwind.config.js` — usar siempre la clase Tailwind (`bg-primary-900`, `text-risk-critical`, etc.), nunca un hex suelto en un componente.

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

---

## Rendimiento y tiempo real

El Dashboard, el Mapa y la campanita de notificaciones dependen de dos canales que
deben funcionar bien juntos: **push en vivo por Socket.io** (la vía normal) y
**polling de respaldo** (red de seguridad si el socket se cae). Requisitos para que
esto se sienta rápido — no son opcionales para producción con guardias reales en
campo:

### Hosting del frontend

- Debe servir Server Actions/Route Handlers cerca de los usuarios (Cochabamba/
  Bolivia) — en Vercel, elegir la región sudamericana disponible más cercana. Cada
  Server Action de este proyecto (`src/lib/data-source.ts`) hace un round-trip
  completo: navegador → frontend → backend (`gamc-api`) → base de datos, y de
  vuelta — la latencia de cada tramo se suma.
- El backend y el frontend deben estar en regiones cercanas entre sí por el mismo
  motivo (ver requisitos de servidor en el README de `gamc-api`).

### Cache: no servir datos viejos por accidente

Este proyecto usa el Data Cache de Next.js (`revalidate` + `tags` en
`src/lib/api/http.ts` y `src/lib/data-source.ts`) para no golpear la base de datos
en cada render. Es un requisito de **correctitud**, no solo de velocidad: **toda
mutación nueva que se agregue debe llamar `revalidateTag(...)` con el tag
correspondiente** (ver el objeto `TAGS` en `data-source.ts`). Sin eso, la próxima
lectura — incluso la disparada por un evento realtime — puede devolver la respuesta
cacheada vieja durante todo el `revalidate` configurado, y algo recién
resuelto/asignado/cambiado se ve "pegado" en la pantalla hasta que el TTL expira
solo (bug real ya corregido una vez con este patrón: la resolución de un SOS tardaba
en reflejarse).

### Conexión del cliente (navegador)

- El socket (`src/lib/api/realtime.ts`) conecta directo al dominio del backend, no
  al del frontend — en producción esto cruza dominios (Vercel ↔ Render/Railway/
  etc.), así que el backend necesita `CORS_ORIGINS` bien configurado y el navegador
  del Operador necesita poder alcanzar ambos dominios sin un proxy/firewall
  corporativo que bloquee WebSockets.
- Si el socket no conecta (red restrictiva, proxy, etc.), el sistema sigue
  funcionando por el polling de respaldo (30-60s según la pantalla) — más lento,
  pero no roto. No hay push en vivo sin WebSockets habilitados en la red del
  Operador.

### Geolocalización

La web nunca pide GPS al navegador — toda la geolocalización viene de la app móvil
de los guardias, vía `gamc-api`. Los requisitos de precisión/frecuencia de esa
geolocalización viven en el README de la app móvil (`appmunicipal`).


