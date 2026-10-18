# GAMC Seguridad — Plataforma Web de Seguridad Ciudadana

**Gobierno Autónomo Municipal de Cochabamba · Dirección de Seguridad Ciudadana**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-000000?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8-010101?logo=socket.io)](https://socket.io)
[![Leaflet](https://img.shields.io/badge/Leaflet-1.9-199900?logo=leaflet)](https://leafletjs.com)

Panel de operaciones en tiempo real para la gestión de guardias, patrullaje, incidentes y análisis de seguridad ciudadana en el municipio de Cochabamba, Bolivia.

---

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Stack técnico](#stack-técnico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Puesta en marcha](#puesta-en-marcha)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Módulos funcionales](#módulos-funcionales)
- [Roles y permisos](#roles-y-permisos)
- [Paleta de colores](#paleta-de-colores)
- [Rendimiento y tiempo real](#rendimiento-y-tiempo-real)
- [Documentación técnica](#documentación-técnica)
- [Convenciones de desarrollo](#convenciones-de-desarrollo)

---

## Descripción general

GAMC Seguridad es el frontend web del sistema integrado de seguridad ciudadana del municipio de Cochabamba. Permite al personal operativo:

- **Monitorear en tiempo real** la ubicación y estado de los guardias en campo vía GPS.
- **Gestionar patrullajes** asignando rutas establecidas, guardadas o dinámicas a unidades activas.
- **Atender alertas SOS** emitidas desde la aplicación móvil de los guardias.
- **Registrar y clasificar incidentes** (hechos) por tipo, nivel de riesgo y zona EPI.
- **Analizar indicadores** de seguridad mediante el dashboard ejecutivo con gráficas y KPIs.
- **Generar reportes** y exportar datos en CSV/PDF.

El sistema opera sobre **6 EPIs** (Estaciones Policiales Integrales) que cubren el territorio municipal, con visibilidad segmentada por rol y zona.

---

## Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js App Router (RSC + Server Actions) | 15.5 |
| UI | React | 19.0 |
| Lenguaje | TypeScript (strict) | 6.0 |
| Estilos | Tailwind CSS | 3.3.6 |
| Mapas GIS | Leaflet + React-Leaflet + react-leaflet-cluster | 1.9 / 5.0 / 4.1 |
| Tiempo real | Socket.IO Client | 4.8.3 |
| Autenticación | jose (JWT RS256) | 6.2 |
| Iconografía | Lucide React | 0.469 |
| Tipografía | IBM Plex Sans | — |
| Backend | gamc-api (Express + PostgreSQL 14+) | — |
| Deploy | Vercel | — |

---

## Estructura del proyecto

```
gamc_seguridad/
├── src/
│   ├── app/                        # Rutas Next.js (App Router)
│   │   ├── (auth)/login/           # Acceso público
│   │   └── (dashboard)/            # Rutas protegidas por rol
│   │       ├── dashboard/
│   │       ├── credenciales/
│   │       ├── guardias/
│   │       ├── hechos/
│   │       ├── mapas/
│   │       └── reportes/
│   │
│   ├── features/                   # Módulos funcionales (1 dominio = 1 carpeta)
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── guardias/
│   │   ├── hechos/
│   │   ├── mapas/
│   │   └── reportes/
│   │       └── <módulo>/
│   │           ├── actions/        # Server Actions ('use server')
│   │           ├── components/     # Componentes del módulo
│   │           └── types.ts
│   │
│   ├── components/                 # Componentes compartidos
│   │   ├── feedback/               # EmptyState, ErrorBanner, Skeleton
│   │   ├── layout/                 # Sidebar, Topbar, PageContainer, GlobalSosBanner
│   │   └── ui/                     # AlertDialog, Badge, Button, Drawer, Input, Modal, Select…
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── http.ts             # Cliente HTTP con renovación automática de JWT
│   │   │   ├── auth.ts             # Endpoints de autenticación
│   │   │   ├── realtime.ts         # Conexión Socket.IO
│   │   │   └── realtimeTicket.ts   # Ticket temporal para handshake WS
│   │   ├── auth-session.ts         # Sesión vía cookies httpOnly
│   │   ├── data-source.ts          # Adaptador (datos reales + simulados temporales)
│   │   ├── permissions.ts          # Matriz RBAC de escritura por rol
│   │   ├── env.ts                  # Validación de variables de entorno
│   │   ├── epis/                   # Catálogo de EPIs (coordenadas, colores, nombres)
│   │   └── hooks/                  # Hooks globales reutilizables
│   │
│   ├── middleware.ts               # Protección de rutas por rol
│   └── types/                      # Tipos TypeScript alineados con el esquema DB
│       ├── user.ts
│       ├── guardia.ts
│       ├── hecho.ts
│       ├── patrulla.ts
│       ├── epi.ts
│       └── …
│
├── database/
│   └── schema.sql                  # Esquema PostgreSQL completo
│
├── docs/                           # Documentación técnica detallada
├── design/                         # Mockups y referencias de diseño
├── cambios/                        # Notas de entrega por fase (F1–F7)
├── public/                         # Activos estáticos
├── next.config.js
├── tailwind.config.js
└── vercel.json
```

---

## Puesta en marcha

### Requisitos previos

- **Node.js** ≥ 20.x
- **npm** ≥ 10.x (no mezclar con `pnpm`/`yarn`, hay `package-lock.json` comprometido)
- Acceso a una instancia de **gamc-api** (backend REST + WebSocket)

### Instalación

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio> gamc_seguridad
cd gamc_seguridad

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores del entorno

# 4. Iniciar el servidor de desarrollo
npm run dev
# → http://localhost:3000
```

---

## Variables de entorno

Crear `.env.local` a partir de `.env.example`. Todas las variables `NEXT_PUBLIC_*` se exponen al navegador.

| Variable | Requerida | Descripción |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Sí | URL base del backend (`https://api.gamc-seguridad.gob.bo`) |
| `NEXT_PUBLIC_WEBSOCKET_URL` | Sí | URL del servidor WebSocket (puede ser el mismo que la API) |
| `JWT_SECRET` | Sí | Secreto para verificar JWTs — debe ser **idéntico** al del backend |
| `NEXT_PUBLIC_MAP_TILE_URL` | No | URL del proveedor de teselas cartográficas (default: OpenStreetMap) |
| `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | No | Atribución HTML del proveedor |
| `NEXT_PUBLIC_MAP_DEFAULT_LAT` | No | Latitud del centro inicial del mapa (default: `-17.3935`) |
| `NEXT_PUBLIC_MAP_DEFAULT_LNG` | No | Longitud del centro inicial (default: `-66.1653`) |
| `NEXT_PUBLIC_MAP_DEFAULT_ZOOM` | No | Nivel de zoom inicial (default: `13`) |

---

## Scripts disponibles

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | Build de producción optimizado |
| `npm run start` | Sirve el build de producción |
| `npm run typecheck` | Verificación de tipos TypeScript (`--noEmit`) |
| `npm run lint` | Análisis estático con ESLint |

---

## Módulos funcionales

| Módulo | Ruta | Descripción | Acceso |
|---|---|---|---|
| **Dashboard** | `/dashboard` | KPIs ejecutivos, gráficas de incidentes por tipo/zona/día | Super Admin, Admin |
| **Mapa** | `/mapas` | Mapa GIS en tiempo real: guardias, rutas, SOS, zonas críticas, puntos fijos | Todos |
| **Guardias** | `/guardias` | Listado, alta y edición de guardias; estado operativo; telemetría | Todos |
| **Hechos** | `/hechos` | Registro de incidentes; clasificación por EPI; cambio de estado | Todos |
| **Reportes** | `/reportes` | Exportación CSV/PDF de guardias, hechos y patrullajes | Todos |
| **Credenciales** | `/credenciales` | Alta de usuarios web y generación de credenciales | Solo Super Admin |

---

## Roles y permisos

El sistema implementa RBAC con tres roles de usuario web:

| Rol | Descripción |
|---|---|
| `super_admin` | Acceso total, incluyendo gestión de usuarios web |
| `admin` | Acceso operativo completo excepto gestión de credenciales |
| `operador_monitoreo` | Acceso de monitoreo y operación; sin acceso al dashboard ejecutivo |

Para la matriz completa de permisos de lectura y escritura por recurso, ver [`docs/permissions.md`](docs/permissions.md).

---

## Paleta de colores

Los tokens de color viven en `tailwind.config.js`. **Siempre usar clases Tailwind** — nunca valores hex sueltos en componentes.

### Marca institucional

| Token | Hex | Uso |
|---|---|---|
| `brand-ink-950` | `#0D0D0E` | Fondo más oscuro |
| `brand-ink-900` | `#1A1A1A` | Sidebar, cabeceras |
| `brand-ink-800` | `#262624` | Superficies elevadas |
| `brand-ink-700` | `#3D3A35` | Bordes oscuros |
| `brand-gold-300` | `#DDBE97` | Texto sobre oscuro |
| `brand-gold-500` | `#C59B6D` | Acento principal |
| `brand-gold-600` | `#A97F52` | Hover del acento |
| `brand-gold-700` | `#8C6740` | Acento presionado |
| `brand-gold-100` | `#F3E7D8` | Superficies doradas sutiles |

### Semántica de riesgo

| Token | Hex | Nivel |
|---|---|---|
| `risk-critical` | `#DC2626` | Muy alto |
| `risk-high` | `#F97316` | Alto |
| `risk-medium` | `#EAB308` | Medio |
| `risk-low` | `#22C55E` | Bajo |

### Neutrales

| Token | Hex | Uso |
|---|---|---|
| `neutral-bg` | `#F5F7FA` | Fondo de página |
| `neutral-border` | `#E5E7EB` | Divisores, bordes |
| `neutral-text` | `#1F2937` | Texto principal |
| `neutral-text-muted` | `#6B7280` | Texto secundario |

---

## Rendimiento y tiempo real

### Canales de datos

La plataforma usa dos canales paralelos para mantener la UI sincronizada:

1. **Push en vivo (Socket.IO)** — vía primaria. Latencia < 1 s para ubicaciones y alertas.
2. **Polling de respaldo** — se activa automáticamente si el socket se desconecta. Intervalo: 30–60 s según el módulo. Más lento, pero el sistema no queda inoperante.

### Cache de Next.js

Todas las mutaciones que modifican datos persistidos **deben llamar `revalidateTag(...)`** con el tag correspondiente definido en `data-source.ts`. Sin ello, el cliente puede ver datos obsoletos durante todo el TTL del caché, incluso si un evento realtime llega correctamente.

```ts
// Ejemplo correcto en un Server Action
await revalidateTag(TAGS.hechos)
```

### Requisitos de red del operador

- El navegador debe poder alcanzar **tanto** el dominio del frontend como el dominio del backend.
- Los WebSockets deben estar permitidos en la red corporativa o proxy del operador.
- La app nunca solicita geolocalización al navegador; toda la telemetría GPS proviene de la app móvil.

---

## Documentación técnica

La carpeta [`docs/`](docs/) contiene documentación técnica detallada:

| Documento | Descripción |
|---|---|
| [`docs/getting-started.md`](docs/getting-started.md) | Guía de instalación y configuración paso a paso |
| [`docs/architecture.md`](docs/architecture.md) | Arquitectura del sistema y decisiones de diseño |
| [`docs/modules.md`](docs/modules.md) | Descripción de cada módulo funcional |
| [`docs/api-reference.md`](docs/api-reference.md) | Referencia de endpoints REST del backend |
| [`docs/realtime-events.md`](docs/realtime-events.md) | Catálogo de eventos Socket.IO |
| [`docs/permissions.md`](docs/permissions.md) | Matriz RBAC completa |
| [`docs/deployment.md`](docs/deployment.md) | Guía de despliegue en producción (Vercel) |
| [`docs/database.md`](docs/database.md) | Esquema de base de datos PostgreSQL |

---

## Convenciones de desarrollo

- **TypeScript strict** activado. No usar `any` ni `as unknown`.
- **Colores**: siempre tokens Tailwind (`bg-brand-ink-900`), nunca hex directos.
- **Server Actions**: toda mutación de datos vive en `features/<módulo>/actions/`. Nunca exponer lógica de sesión o JWT en componentes cliente.
- **Tags de caché**: toda mutación debe invalidar el tag correspondiente con `revalidateTag`.
- **Gestor de paquetes**: exclusivamente `npm`. No commitear `pnpm-lock.yaml` ni `yarn.lock`.
- **Ramas**: `main` es la rama estable. Los cambios entran por pull request.

---

> Gobierno Autónomo Municipal de Cochabamba — Dirección de Seguridad Ciudadana  
> Plataforma desarrollada para la reingeniería operativa del sistema de seguridad municipal.
