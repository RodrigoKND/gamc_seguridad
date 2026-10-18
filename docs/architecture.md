# Arquitectura del sistema

Descripción de la arquitectura de GAMC Seguridad, sus decisiones de diseño y las interacciones entre capas.

---

## Vista general

```
┌─────────────────────────────────────────────────────────┐
│                    Navegador (Operador)                  │
│                                                         │
│  ┌───────────────┐          ┌──────────────────────┐    │
│  │  Next.js App  │  HTTP    │   Socket.IO Client   │    │
│  │  (RSC + CSR)  │◄────────►│  (tiempo real)       │    │
│  └──────┬────────┘          └──────────┬───────────┘    │
└─────────┼────────────────────────────┼────────────────┘
          │ Server Actions / fetch       │ WebSocket
          ▼                             ▼
┌─────────────────────────────────────────────────────────┐
│                    gamc-api (Backend)                   │
│              Express.js + PostgreSQL 14+                │
│                                                         │
│   REST API   │   Socket.IO Server   │   Job Scheduler  │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐      ┌─────────────────────────────┐
│  PostgreSQL 14+ │      │   App Móvil (guardias)      │
│  (base de datos)│      │   React Native + GPS        │
└─────────────────┘      └─────────────────────────────┘
```

---

## Capas del frontend

### App Router (Next.js 15)

El proyecto usa el **App Router** de Next.js con React Server Components (RSC) como capa de presentación primaria. La mayor parte del fetching de datos ocurre en Server Components o Server Actions, lo que mantiene las credenciales (JWT, cookies) fuera del bundle del cliente.

```
src/app/
├── (auth)/login/          # Route group público — sin middleware de autenticación
└── (dashboard)/           # Route group protegido — toda ruta requiere sesión válida
    ├── layout.tsx          # Layout compartido: Sidebar + Topbar + GlobalSosBanner
    ├── dashboard/
    ├── guardias/
    ├── hechos/
    ├── mapas/
    ├── reportes/
    └── credenciales/
```

### Middleware de protección de rutas

`src/middleware.ts` intercepta todas las peticiones a rutas del grupo `(dashboard)`:

1. Lee la cookie `gamc_access` (JWT httpOnly).
2. Verifica la firma y expiración del token con `jose`.
3. Extrae el rol del usuario (`super_admin`, `admin`, `operador_monitoreo`).
4. Redirige a `/login` si el token es inválido o la ruta no está permitida para ese rol.

### Features (módulos funcionales)

Cada dominio funcional vive en su propio directorio bajo `src/features/`:

```
src/features/<módulo>/
├── actions/         # Server Actions (mutaciones de datos, 'use server')
├── components/      # Componentes React del módulo (pueden ser Server o Client)
├── hooks/           # Hooks específicos del módulo (solo en Client Components)
└── types.ts         # Tipos TypeScript del dominio
```

Esta estructura mantiene la lógica de cada dominio colocada junto a sus componentes, sin acoplamiento cruzado.

### Componentes compartidos

`src/components/` contiene componentes reutilizables entre módulos:

- **`ui/`**: Primitivos de UI (Button, Input, Select, Modal, Drawer, Badge, AlertDialog…)
- **`layout/`**: Estructura de página (Sidebar, Topbar, PageContainer, GlobalSosBanner)
- **`feedback/`**: Estados de carga y error (Skeleton, EmptyState, ErrorBanner)

### Librería de utilidades (`src/lib/`)

| Archivo/carpeta | Responsabilidad |
|---|---|
| `api/http.ts` | Cliente HTTP con renovación automática de JWT (intercept 401 → refresh → retry) |
| `api/realtime.ts` | Singleton del cliente Socket.IO; gestiona reconexión automática |
| `api/realtimeTicket.ts` | Obtiene un ticket de un solo uso para el handshake WebSocket autenticado |
| `auth-session.ts` | Lee y escribe cookies de sesión (server-side only) |
| `data-source.ts` | Capa de abstracción de datos: delega a la API real o a datos simulados según el módulo |
| `permissions.ts` | Matriz RBAC: exporta `canWrite(rol, recurso)` |
| `env.ts` | Valida y exporta las variables de entorno en tiempo de arranque |
| `epis/` | Catálogo estático de EPIs con coordenadas, colores y nombres oficiales |

---

## Flujo de autenticación

```
1. Usuario → POST /api/auth/login (identifier + password)
2. Backend valida credenciales
3. Backend emite cuatro cookies httpOnly:
   - gamc_access   (JWT, 15 min)
   - gamc_refresh  (token de rotación)
   - gamc_profile  (datos de usuario cacheados)
   - gamc_xsrf     (token anti-CSRF)
4. Middleware de Next.js verifica gamc_access en cada request
5. Si gamc_access expira → apiFetch llama POST /api/auth/refresh
6. Backend rota el refresh token y emite un nuevo access token
7. Si el refresh falla → redirige a /login
```

---

## Flujo de datos en tiempo real

```
App Móvil (guardia GPS)
        │
        ▼
  gamc-api (Socket.IO Server)
        │  emite eventos a sala del operador
        ▼
  Socket.IO Client (navegador)
        │  actualiza estado React local
        ▼
  Componentes del mapa / dashboard
```

Para la lista completa de eventos, ver [`realtime-events.md`](realtime-events.md).

Si el socket se desconecta, los módulos activan automáticamente un **polling de respaldo** con intervalos de 30–60 segundos para mantener la UI sincronizada.

---

## Estrategia de caché

Next.js Data Cache se usa para evitar golpear la base de datos en cada render de Server Component. Cada colección de datos tiene un **tag** definido en `src/lib/data-source.ts`:

```ts
export const TAGS = {
  guardias:     'guardias',
  hechos:       'hechos',
  patrullas:    'patrullas',
  rutasPlantilla: 'rutas-plantilla',
  puntosFijos:  'puntos-fijos',
  programacion: 'programacion',
  dashboard:    'dashboard',
} as const
```

**Regla crítica**: toda Server Action que mute datos debe llamar `revalidateTag(TAGS.<recurso>)` al finalizar. Sin esto, el cliente puede ver datos obsoletos hasta que expire el TTL natural del caché.

---

## Decisiones de diseño

### Por qué App Router y no Pages Router

El App Router permite colocar la lógica de fetching directamente en Server Components, eliminando la necesidad de `getServerSideProps` y reduciendo la superficie de cliente. Esto es crítico para no exponer el JWT al bundle del navegador.

### Por qué Server Actions para mutaciones

Las mutaciones (crear guardia, asignar ruta, atender SOS) usan Server Actions porque permiten:
- Acceder a las cookies httpOnly del servidor (JWT) sin exponerlas al cliente.
- Llamar a `revalidateTag` para invalidar el caché de forma atómica con la mutación.
- Simplificar el manejo de errores sin necesidad de un cliente HTTP en el navegador.

### Por qué jose y no jsonwebtoken

`jsonwebtoken` no es compatible con el Edge Runtime de Next.js (usado por el Middleware). `jose` es una implementación basada en Web Crypto API, compatible con todos los entornos de ejecución de Next.js.

### Por qué Leaflet y no Google Maps / Mapbox

- Sin costos por solicitud de tiles (usando OpenStreetMap).
- Funciona con proveedores de tiles privados o locales (requisito de soberanía de datos).
- `react-leaflet-cluster` maneja eficientemente cientos de marcadores simultáneos.
