# MASTER.md — Sistema de Diseño y Especificación Técnica
## Plataforma Web · Seguridad Ciudadana GAMC (Cochabamba, Bolivia)

> Fuente única de verdad para Claude Code (Etapa 3: pulido visual y generación de
> código de producción). Todo componente, pantalla o ajuste debe referenciar este
> documento antes de introducir tokens, layouts o copys nuevos.

---

## 0. Contexto del proyecto

- **Proyecto:** Reingeniería de la Dirección de Seguridad Ciudadana — GAMC Cochabamba
  (contest de innovación universitaria).
- **Alcance de este documento:** Plataforma Web únicamente (Admin, Dashboard,
  Módulo de Mapas GIS, Reportería). La App Móvil la desarrolla un equipo paralelo.
- **Meta interna:** 10 de septiembre de 2026 — Fases 1 a 4 (Shell + Módulo de Mapas
  funcional). La Fase 5 (ingesta completa de telemetría/reportes) puede deslizarse
  después de la meta.
- **Stack obligatorio:** React, Next.js, TypeScript 6.0, Tailwind CSS v3.3, PostgreSQL.
- **Equipo:** Rodrigo (PO / Web Lead), Alison (SM / Mobile Lead), Leonardo
  (QA / Integración / Analytics Lead).
- **División Dev A / Dev B:** ver sección 8.
- **Estructura de carpetas:** ver sección 6.
- **Base de datos en evolución:** el schema actual (`schema_gamc_seguridad_v3.sql`)
  NO es definitivo — el equipo móvil aplicará sus propios ajustes finales, y el
  equipo web también incorporará cambios futuros. Por esto, toda la capa de
  acceso a datos debe construirse con una interfaz/adaptador intermedio (ver
  sección 13, instrucción 1) para que un cambio de schema implique tocar un
  adaptador y los tipos en `types/`, no reescribir componentes.

---

## 1. Versiones fijadas del stack

| Tecnología | Versión | Notas de configuración |
|---|---|---|
| TypeScript | 6.0 | `strict` mode viene activado por defecto en esta versión — no desactivar salvo justificación explícita. Resolución de módulos por defecto: `esnext`. Target `es5` y módulos AMD/UMD están deprecados, no usar. |
| Tailwind CSS | v3.3 | Configuración clásica vía `tailwind.config.js` (no v4/CSS-first config). Todos los tokens de la sección 4 van en `theme.extend`. |
| Next.js | según última estable compatible con TS 6.0 | Confirmar compatibilidad antes de `npm install` — fijar versión exacta en `package.json`, no usar `latest`. |
| PostgreSQL | según disponibilidad de hosting municipal | Sin versión fijada aún — pendiente de decisión de infraestructura. |

---

## 2. Stack y herramientas del pipeline

| Etapa | Herramienta | Rol |
|---|---|---|
| 1 — IA / IxD | Este chat (Claude) | Arquitectura de información, interacción, reglas de sistema de diseño |
| 2 — Prototipo estructural | Claude Design | Wireframes / mockups de alta fidelidad en React + Tailwind |
| 3 — Pulido de producción | **Claude Code** + skill `ux-ui-pro-max` | Contraste WCAG AA/AAA, tokens exactos, iconografía Lucide, microinteracciones, código final |


---

## 3. Tipografía — IBM Plex Sans

```js
// tailwind.config.js — theme.extend.fontFamily
fontFamily: {
  sans: ['"IBM Plex Sans"', 'sans-serif'],
}
```

| Uso | Clase Tailwind | Tamaño / line-height | Peso |
|---|---|---|---|
| Metadatos, timestamps | `text-xs` | 12px / 16px | 400 |
| Cuerpo de tabla | `text-sm` | 14px / 20px | 400–500 |
| Cuerpo general | `text-base` | 16px / 24px | 400 |
| Título de tarjeta | `text-lg font-medium` | 18px / 28px | 500 |
| Encabezado de sección | `text-xl font-semibold` | 20px / 28px | 600 |
| KPI secundario | `text-2xl font-semibold` | 24px / 32px | 600 |
| KPI principal | `text-3xl font-bold` | 30px / 36px | 700 |
| Título de página | `text-4xl font-bold` | 36px / 40px | 700 |

---

## 4. Tokens de color

> **Actualización 2026-10-05 — paleta Innova, alineada con la app móvil.**
> La plataforma adopta la identidad de la web/app municipal **Innova**
> (`innova.cochabamba.bo`) con **los mismos valores que la app móvil de
> guardias** (`appmunicipal/src/theme/colors.ts`), para que ambos productos
> del GAMC se vean como una sola familia. Rediseño hecho con el skill
> `ui-ux-pro-max` (estilo recomendado para gobierno: *Accessible & Ethical* —
> superficies planas, alto contraste, foco visible; anti-patrón evitado:
> *AI purple/pink gradients*). **El logo (escudo negro + bronce) no se
> modifica.**
>
> Reemplaza a las paletas anteriores (`brand-ink-*`/`brand-gold-*`,
> `brand-navy-*`/`brand-blue-600` y el intermedio `brand-purple-*`/
> `brand-rose-*`), que ya no existen en `tailwind.config.js`. Equivalencias
> por si aparece código viejo en otra rama: tinta/navy/purple → `primary-*`;
> gold/rose → `accent-*` (ver roles abajo). Props: `accent="gold"` →
> `"rose"`, `accent="blue"` → `"purple"`, `Button variant="ink"` → `"brand"`.

Los componentes usan **tokens semánticos** (`primary-*`, `accent-*`,
`neutral-*`), nunca hex sueltos. Excepción documentada: HTML de marcadores
Leaflet y `<svg>` de gráficos, que no leen clases — ahí se copian los hex de
esta tabla.

```js
// tailwind.config.js — theme.extend.colors
colors: {
  // Primario — morado Innova (origen entre paréntesis)
  'primary-950': '#3A2C6B',   // derivado: hover de botones primary-900
  'primary-900': '#4D3B86',   // app navy900. Títulos, botón `brand`, tooltips de gráficos
  'primary-800': '#5A4794',   // app navy800. Links, íconos de Topbar, texto sobre lila
  'primary-700': '#6B559F',   // Innova sidebar/navbar = app `brand`. Sidebar, panel de login, botón `primary`, anillo de foco, chips activos, avatares
  'primary-500': '#8C78BF',   // derivado: último tono de rampas de gráficos
  'primary-300': '#B8A9DA',   // derivado: bordes de hover
  'primary-200': '#E1D9F2',   // app lilacStrong. Anillo de .icon-badge, gridlines
  'primary-100': '#EFEAF8',   // app lilac. Relleno de .icon-badge, filas seleccionadas, chips
  'primary-50':  '#F5F2FA',   // app background. Hover de celdas, cajas informativas

  // Acento — rosa Innova (el check del logo Innova = app `gold`)
  'accent-700': '#9E2248',    // derivado: hover de accent-600
  'accent-600': '#C2335D',    // derivado: ícono del ítem activo, tabs activos, flecha de KPI (texto/ícono sobre blanco)
  'accent-500': '#E8567F',    // app gold. SOLO no-texto o texto grande: el "?" del saludo, borde de avatares, punto "hoy" y barra dominante de gráficos, selección en el mapa, foco de formularios de marca
  'accent-300': '#F28BA6',    // app goldLight. Rombo del divisor del login
  'accent-100': '#FCE8EE',    // derivado: tinte

  // Neutrales — tintados en lila (mismos valores que la app)
  'neutral-bg':          '#F5F2FA',
  'neutral-border':      '#DDD6EC',
  'neutral-text':        '#1F1A2E',
  'neutral-text-muted':  '#6B6880',

  // Semántica de riesgo / estado y Territorial (EPI) — sin cambios, no son marca
  'risk-critical': '#DC2626', 'risk-high': '#F97316', 'risk-medium': '#EAB308', 'risk-low': '#22C55E',
  'epi-norte': '#5DADE2', 'epi-central': '#26A69A', 'epi-sud': '#F5A623', 'epi-cona': '#8E6FCE', 'epi-centro': '#0B1B3D',
}
```

**Componentes compartidos de ícono/avatar** (`src/app/globals.css`, `@layer
components`) — un solo lenguaje visual en todo el sistema, copiado de la app:
- `.icon-badge` — círculo `primary-100` con anillo `primary-200` e ícono
  `primary-800`. Para todo ícono con contenedor (tarjetas de Credenciales,
  modalidades del wizard, estados vacíos, encabezado del login). En tarjetas
  clicables pasa a relleno `primary-700` + ícono blanco al hover/foco (como
  el menú de Inicio de la app).
- `.avatar-initials` — iniciales blancas sobre `primary-700` con borde
  `accent-500`, igual que el `Avatar` de la app (Topbar, tablas, listas).
  Los marcadores de guardia del mapa replican el mismo estilo en hex.

**Reglas de uso:**
- **Superficies planas.** Sidebar y panel del login en `primary-700` sólido —
  sin degradados, halos ni marcas de agua (el escudo negro difuminado sobre
  lila se leía como mancha).
- **Sidebar:** ítems inactivos `white/85`; activo = píldora blanca con texto
  `primary-900` e ícono `accent-600`; foco = anillo blanco con offset lila.
- **El rosa es escaso** (como en Innova y la app): solo para lo que "hay que
  mirar ahora" — ítem activo, tab activo, flecha de KPI, punto de hoy, barra
  dominante, selección en el mapa, el "?" del saludo de inicio y el borde de
  "sello" de las cajas de credenciales. Selección, links, chips y botones van
  en `primary-*`.
- **Anillo de foco único:** `primary-700` en todo el sistema; `accent="rose"`
  en Input/Select/Modal lo cambia a `accent-500` para formularios de marca.
- **Botones:** `primary` = `primary-700`; `brand` = `primary-900` (CTA de
  formularios: Ingresar, Generar, Asignar); `destructive` = `risk-critical`.
- **Saludo de inicio** (Dashboard): "Hola, {nombre} — ¿Qué quieres revisar
  hoy ?" con el "?" en `accent-500` a `text-xl font-extrabold` (texto grande →
  3:1 suficiente). Mismo detalle que la pantalla Inicio de la app.
- `accent-500` nunca como texto pequeño (3.46:1).
- Colores de riesgo/EPI son reservas semánticas: no reutilizar fuera de su contexto.
- Paleta de rutas del mapa (`features/mapas/lib/routeColors.ts`): sin púrpuras
  ni rosas — se confundirían con marcadores de guardia y selección.

**Contraste verificado** (WCAG AA: texto ≥4.5:1, texto grande/no-texto ≥3:1):

| Par | Ratio | Uso |
|---|---|---|
| `neutral-text` sobre blanco | 16.86:1 | Texto de cuerpo |
| `primary-900` sobre blanco | 9.19:1 | Títulos, botón `brand`, texto del ítem activo |
| `primary-800` sobre blanco | 7.60:1 | Links, íconos de Topbar |
| `primary-800` sobre `primary-100` | 6.44:1 | Ícono de `.icon-badge` |
| blanco sobre `primary-700` | 6.13:1 | Sidebar, login, avatares, chips activos |
| `white/85` sobre `primary-700` | 4.98:1 | Ítems inactivos del sidebar, textos del login |
| `primary-700` sobre `neutral-bg` | 5.54:1 | Links sobre fondo de página |
| `neutral-text-muted` sobre blanco | 5.36:1 | Texto secundario |
| `neutral-text-muted` sobre `neutral-bg` | 4.84:1 | Texto secundario sobre fondo |
| `accent-600` sobre blanco | 5.35:1 | Tab activo, ícono activo, flecha de KPI |
| `accent-500` sobre blanco | 3.46:1 | Solo no-texto o texto grande ("?" del saludo) |

**Motivos de identidad visual:**
- **Divisor heráldico:** filete—rombo (`rotate-45`)—filete en el panel del
  login (filetes `white/25`, rombo `accent-300`).
- **Logo enmarcado:** el escudo, sin modificaciones, dentro de un marco
  translúcido `white/15` con anillo `white/25` (sidebar y login).
- ~~Marca de agua de escudo~~ y ~~halos/degradados~~ — retirados en el
  rediseño 2026-10-05 (ver arriba).
- ~~Filete superior en tarjetas claras~~ — descartado (feedback repetido del
  usuario, 2026-09-07): **no volver a agregar** una barra de 3px en el borde
  superior de tarjetas/modales. El borde izquierdo `accent-500` en cajas de
  credenciales sigue vigente como acento de "sello".

---

## 5. Iconografía

Lucide Icons exclusivamente. No mezclar con otros sets (Heroicons, Font Awesome, etc.).

---

## 6. Estructura de carpetas del proyecto

Estándar híbrido (feature-based + capa compartida), alineado a App Router de
Next.js — es el patrón recomendado en la industria para 2026 en proyectos de
este tamaño (equipo pequeño, múltiples dominios funcionales bien definidos).
Todo componente, conector, artefacto o estilo nuevo debe ubicarse según esta
estructura; no crear carpetas nuevas en la raíz sin actualizar este documento.

```
gamc-seguridad-web/
├── src/
│   ├── app/                        # App Router — rutas y layouts
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── mapas/page.tsx      # Módulo de Mapas (tabs internos)
│   │   │   ├── hechos/page.tsx
│   │   │   ├── patrullas/page.tsx
│   │   │   ├── guardias/page.tsx
│   │   │   ├── reportes/page.tsx
│   │   │   ├── configuracion/page.tsx
│   │   │   ├── auditoria/page.tsx
│   │   │   └── layout.tsx          # Sidebar + Topbar shell
│   │   ├── api/                    # Route handlers (si no usan Server Actions)
│   │   │   └── [...]/route.ts
│   │   ├── layout.tsx              # Layout raíz
│   │   └── globals.css             # Import de Tailwind + variables CSS
│   │
│   ├── features/                   # Un dominio funcional = un módulo del MASTER.md
│   │   ├── auth/
│   │   │   ├── components/         # LoginForm, CredentialModal, etc.
│   │   │   ├── hooks/              # useAuth, useSession
│   │   │   ├── actions/            # Server Actions (login, logout)
│   │   │   └── types.ts
│   │   ├── dashboard/
│   │   │   ├── components/         # KpiCard, ActivityFeed, MiniMapPreview
│   │   │   └── types.ts
│   │   ├── mapas/                  # Módulo de Mapas unificado (sección 7 IA)
│   │   │   ├── components/
│   │   │   │   ├── MapCanvas.tsx       # instancia única, compartida entre tabs
│   │   │   │   ├── PatrolLayer.tsx
│   │   │   │   ├── HeatmapLayer.tsx
│   │   │   │   ├── FutureLayerPlaceholder.tsx
│   │   │   │   ├── MapFilters.tsx
│   │   │   │   └── TelemetryDrawer.tsx
│   │   │   ├── hooks/               # useMapLayer, useGuardTelemetry
│   │   │   └── types.ts
│   │   ├── guardias/
│   │   │   ├── components/          # GuardTable, GuardCreateModal, GuardCatalogModal
│   │   │   ├── actions/
│   │   │   └── types.ts
│   │   ├── hechos/
│   │   │   ├── components/          # IncidentTable, IncidentDetailDrawer
│   │   │   └── types.ts
│   │   └── reportes/
│   │       ├── components/          # ExportFilters, ReportTable
│   │       ├── actions/             # exportPDF, exportExcel
│   │       └── types.ts
│   │
│   ├── components/                 # Capa compartida — reutilizable entre features
│   │   ├── ui/                     # Primitivos: Button, Card, Badge, Input, Modal
│   │   ├── layout/                 # Sidebar, Topbar, PageContainer
│   │   └── feedback/                # EmptyState, ErrorBanner, Skeleton
│   │
│   ├── lib/                        # Conectores e integraciones externas
│   │   ├── db.ts                   # Cliente PostgreSQL (singleton)
│   │   ├── auth.ts                 # Config JWT/sesión
│   │   ├── websocket.ts            # Conexión tiempo real (telemetría/mapa)
│   │   └── api-client.ts           # Cliente fetch tipado para contratos OpenAPI
│   │
│   ├── hooks/                      # Hooks genéricos, no atados a un feature
│   │   └── useDebounce.ts
│   │
│   ├── types/                      # Tipos compartidos (no exclusivos de un feature)
│   │   ├── risk.ts                 # Enum de niveles de riesgo
│   │   └── epi.ts                  # Enum de jurisdicciones EPI
│   │
│   └── styles/
│       └── tokens.css              # Variables CSS derivadas de la sección 4
│
├── design/
│   └── mockups/                    # Exportes de Claude Design (Etapa 2)
│
├── public/                         # Assets estáticos (íconos, placeholder de marca)
│
├── MASTER.md                       # Este archivo — fuente única de verdad
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

**Reglas de ubicación:**
- Un componente usado en **un solo módulo** va dentro de `features/{modulo}/components/`.
- Un componente usado en **dos o más módulos** se promueve a `components/ui/` o
  `components/feedback/` (nunca se duplica).
- Los estados obligatorios de la sección 9 (`EmptyState`, `ErrorBanner`,
  `Skeleton`) viven en `components/feedback/` y se reutilizan en todos los
  módulos — no reimplementar por feature.
- Conectores a servicios externos (base de datos, WebSocket, cliente API)
  siempre en `lib/`, nunca embebidos dentro de un componente.
- Los mockups exportados de Claude Design van en `/design/mockups/`, fuera de
  `src/` — son referencia visual, no código de producción.
- División Dev A / Dev B (sección 8): Dev A trabaja principalmente en
  `features/mapas/`, `features/dashboard/` y `components/`; Dev B trabaja
  principalmente en `lib/`, `features/auth/actions/` y `app/api/`. Evitar que
  ambos editen el mismo archivo en la misma fase.

## 7. Arquitectura de Información (IA)

### 7.1 Grid espacial

| Zona | Dimensión | Responsivo | Contenido |
|---|---|---|---|
| Sidebar | 260px expandido / 72px colapsado | `<lg`: drawer overlay con backdrop | Logo, nav tree, rol activo |
| Topbar | 64px, `sticky top-0` | Hamburguesa en móvil | Breadcrumb, campana de alertas, menú de usuario |
| Main Stage | Fluido, `max-w-[1600px] mx-auto px-6 py-6` | Grid 12 cols → 1 col `<md` | Contenido del módulo activo |
| Sub-header de tabs (Módulo de Mapas) | 48px, sticky bajo topbar | Tabs colapsan a dropdown `<sm` | Selector Patrullaje / Calor / Futuro |

### 7.2 Árbol de navegación — diferenciado por rol (Opción A: ocultación completa)

**Decisión confirmada:** Cada rol renderiza un árbol de navegación distinto; 
los ítems sin acceso no aparecen en el sidebar, no se
muestran deshabilitados. Ver sección 15 para la lógica completa de permisos,
el porqué de cada corte de alcance para este MVP, y la regla de defensa en
profundidad (el backend debe validar esto también, ocultar en el sidebar no
es suficiente por sí solo).

```
SUPER ADMINISTRADOR
Dashboard
├── Generar Credenciales
│   └── Selector de tipo: Operador de Monitoreo / Guardia / Administrador
└── Gestión de Guardias
    └── Editar / Activar / Desactivar
        (el alta ya vive en "Generar Credenciales" — no se duplica acá)

ADMINISTRADOR
Dashboard
└── Gestión de Guardias
    └── Editar / Activar / Desactivar
        (sin crear — solo Super Admin genera credenciales nuevas)

OPERADOR DE MONITOREO
Dashboard
├── Módulo de Mapas
│   ├── Tab: Mapa de Patrullaje en Vivo
│   ├── Tab: Mapa de Calor / Zonas de Riesgo
│   └── Tab: Futuras vistas GIS (placeholder escalable)
├── Guardias (solo lectura — para ver disponibilidad al asignar rutas)
└── Reportes
    └── Cambio de estado vía desplegable (Abierto / En Proceso / Resuelto)
```

**Fuera de alcance para este MVP, en los 3 roles:** Auditoría, Gestión de
Roles y Permisos, Gestión de Usuarios (cuentas web de Operador/Admin). Siguen
siendo requerimientos válidos del proyecto (RF-05, RF-06, RF-14) — se
recortan solo de esta demo por tiempo, no se descartan del alcance final.
Ver sección 15.2 para el detalle de cada corte.

**Regla clave del Módulo de Mapas:** las pestañas comparten una única instancia del
canvas de mapa (Leaflet/Mapbox). Al cambiar de tab **no se recarga el mapa base**
(zoom/centro persisten) — solo se intercambia la capa de datos activa
(`patrol-layer` ↔ `heatmap-layer`). Transición de capas: fade `duration-200`, sin
parpadeo del basemap.

### 7.3 Pantallas y componentes por módulo

| Pantalla | Componentes clave | RF relacionados |
|---|---|---|
| Login | Form, validación inline, estados loading/error/éxito | RF-02, RF-03 |
| Dashboard Shell | Topbar, sidebar, KPI cards (Patrullas Activas, Hechos Abiertos, Estado EPI, SLA), feed de actividad, mini-mapa preview — **compartido por los 3 roles sin rediseño para este MVP** (ver nota en sección 15.3) | Dashboard Estadístico Grupo 4 |
| Módulo de Mapas — Tab Patrullaje | Canvas mapa, clustering de guardias, filtros EPI/riesgo/turno, selector de rango temporal, toggle WebSocket, drawer telemetría (400px) — **solo Operador** | RF-G1-01/02, RF-G3-09/10 |
| Módulo de Mapas — Tab Calor/Riesgo | Capa heatmap, panel lateral de Puntos Rojos, filtros de índice de riesgo — **solo Operador** | Grupo 4 completo |
| Módulo de Mapas — Tab Futuro | Estado vacío ("Próximas capas: cámaras, geocercas") — **solo Operador** | ESC-01, ESC-03 |
| Generar Credenciales — Formulario | Selector de tipo (Operador/Guardia/Administrador). Guardia: Primer Nombre, Segundo Nombre, Apellido Paterno, Apellido Materno, CI, Fecha de Nacimiento, Teléfono, EPI (sin foto). Operador/Administrador: email — **solo Super Admin** | RF-01, RF-03 |
| Generar Credenciales — Confirmación | Usuario y contraseña generados, mostrados en texto plano UNA sola vez, botón copiar, aviso de cambio obligatorio en primer login — **solo Super Admin** | RF-01, RF-03 |
| Gestión de Guardias — Listado | Tabla (foto o iniciales, nombre completo, cédula, EPI, badge de cuenta + badge operativo), búsqueda, editar por fila, activar/desactivar. **Super Admin y Admin: sin botón de crear** (vive en Generar Credenciales). **Operador: solo lectura**, sin editar/activar | RF-01, RF-12 |
| Drawer de detalle de guardia (Módulo de Mapas) | Nombre, badge operativo, ubicación en lenguaje natural, EPI más cercana, hora inicio/fin de turno, batería, último ping GPS — header completo en rojo pulsante si emergencia — **solo Operador** | RF-G3-09/10 |
| Modal de asignación de ruta | Selector de dos modos: "Usar ruta predefinida" (dropdown + preview) / "Dibujar ruta libre" (herramienta sobre el mapa) — **solo Operador** | RF-G3-09 |
| Reportes / Hechos | Tabla (ID, tipo, severidad, ubicación/EPI, timestamp, reportante, estado, evidencia), drawer de detalle con narrativa + mapa + desplegable editable de estado (Abierto/En Proceso/Resuelto) — **solo Operador**, sin historial de auditoría en este MVP | RF-G3-02 a 08, RF-10, RF-XX Exportación |
| Panel de Puntos Rojos | Listado con dirección aproximada real por zona (ej. "Av. Heroínas esq. Ayacucho — Muy Alto — 15 hechos") — **solo Operador** | Grupo 4 |

---

## 8. División de trabajo — Dev A / Dev B

| Fase | Dev A (Frontend / UI / GIS visual) | Dev B (Backend / Datos / Auth) |
|---|---|---|
| F1 (28–30 ago) | Setup Next.js + Tailwind, tokens de diseño, componentes base (Button, Card, Badge de riesgo) | Esquema PostgreSQL inicial (usuarios, roles, permisos — RF-01 a RF-08) |
| F2 (31 ago–3 sep) | Login Super Admin + generador de credenciales (UI) | Endpoints JWT (RF-02 a RF-04), lógica de roles/permisos (RF-05 a RF-07) |
| F3 (4–5 sep) | Shell del Dashboard: sidebar, layout, navegación | Contratos API (OpenAPI) para telemetría GPS y reportes desde móvil |
| **F4 (6–9 sep) — META 10/09** | Módulo de Mapas: Patrullaje + Calor, clustering, capas persistentes, drawer telemetría | WebSocket/polling en tiempo real, endpoint de zonas críticas |
| F5 (post 10/09) | UI de ingesta de reportes de incidentes y evidencia | Cola de sincronización offline, validación de esquema (RF-13) |

**Regla de ramas:** cada fase se trabaja en ramas independientes por developer
(`dev-a/fase-N`, `dev-b/fase-N`) para evitar colisiones de merge. Ningún componente
de la estructura de carpetas (sección 6) debe ser modificado por ambos
developers en la misma fase.

---

## 9. Estados de interfaz obligatorios (todo componente)

| Estado | Regla |
|---|---|
| `default` | Estilo base, sin interacción |
| `hover` | `transition-colors duration-200`, elevación ligera en cards (`hover:shadow-md`) |
| `focus` | `focus:ring-2 focus:ring-primary-700 focus:ring-offset-2` (o `ring-accent-500` vía `accent="rose"` en formularios de marca) — obligatorio en todo elemento interactivo |
| `active/selected` | Borde izquierdo 3px en sidebar; tabs activos con `border-b-2 border-accent-600 text-accent-600 font-medium` |
| `loading` | Skeleton (`animate-pulse`) — nunca spinner genérico aislado |
| `empty` | Texto municipal + acción sugerida (ej. "Sin zonas críticas activas en este filtro") |
| `error` | Banner rojo suave + botón "Reintentar" — no bloquear toda la pantalla si el error es parcial |
| `disabled` | `opacity-50 cursor-not-allowed`, sin eventos hover |

---

## 10. Reglas de interacción (IxD) críticas

- **Filtrado del mapa:** multi-select riesgo (4 niveles) × EPI (5 zonas), combinables
  (AND entre categorías, OR dentro de cada una). Debounce 300ms. Aplicación
  optimista en cliente, reconciliación por WebSocket.
- **Pérdida de conexión en tiempo real:** banner discreto "Mostrando última posición
  conocida — hace Xs", nunca bloqueo total del mapa.
- **Drawer de telemetría:** 400px, desliza desde la derecha, `transition-transform
  duration-200`. Header pulsante rojo si el guardia tiene SOS activo; ese pin no se
  agrupa en clustering.
- **Modal de credenciales:** al generar, mostrar usuario/contraseña temporal + botón
  "Copiar" + checkbox no editable ("El guardia deberá cambiar su contraseña en el
  primer inicio de sesión"). Error de CI duplicado: inline bajo el campo, sin cerrar
  el modal.
- **Dos badges de estado en guardia (no uno solo):** cuenta administrativa
  ("Pendiente de activación" ámbar borde punteado / "Activo" verde / "Inactivo"
  gris) siempre separada del estado operativo en tiempo real ("Fuera de servicio"
  gris / "En servicio" verde / "Emergencia" rojo pulsante). Nunca combinar ambos
  en un solo badge — son conceptos independientes (ver sección 14).
- **Emergencia en el drawer de guardia:** si estado operativo = emergencia, el
  **header completo del drawer** pasa a rojo pulsante (no solo un ícono aislado) —
  debe ser imposible de ignorar visualmente para el Operador.
- **Modal de asignación de ruta:** dos modos explícitos y mutuamente excluyentes
  (tabs o radio buttons) — "Usar ruta predefinida" (dropdown de plantillas +
  mini-mapa de preview) vs "Dibujar ruta libre" (herramienta de polígono). Al
  elegir plantilla, el polígono se copia y queda editable de forma independiente.
- **Cambio de estado de hecho:** desplegable con 3 opciones (Abierto/En
  Proceso/Resuelto) dentro del drawer de detalle — debe verse claramente como
  una acción manual del Operador, con el mismo tratamiento visual que el resto
  de controles editables del sistema (no como un dato de solo lectura).

---

## 11. Reglas de componentes

- **Botones:** `primary` (primary-700, texto blanco) · `brand` (primary-900,
  CTA de formularios de marca) · `secondary` (outline, texto primary-900)
  · `destructive` (risk-critical — reservado exclusivamente a SOS/eliminar, nunca
  decorativo).
- **Cards:** `rounded-xl border border-neutral-border shadow-sm p-6`.
- **Badge de riesgo/severidad:** fondo al 10% de opacidad del color semántico +
  texto sólido del mismo color.
- **Tabs del Módulo de Mapas:** `border-b border-neutral-border`, tab activo con
  `border-b-2 border-accent-600`.
- **PageHeader** (`components/layout/PageHeader.tsx`, 2026-09-07, portado desde
  `refactor/dashboard-design`): encabezado de página — título (`text-4xl
  font-bold text-primary-900`, sección 3) + subtítulo opcional + acciones a
  la derecha. Usarlo al abrir cada página del dashboard en vez de un `<h1>`
  suelto, para que todas abran igual.
- **Cinta de KPIs "hoja de registro"** (`KpiGrid`/`KpiCard`, 2026-09-07,
  portado desde `refactor/dashboard-design`): reemplaza las 4 cards sueltas
  con ícono por **una sola tarjeta** (`rounded-2xl border border-neutral-border
  bg-white shadow-sm`) dividida en columnas por hairlines (`border-neutral-border`).
  Sin íconos ni chips de color — número grande (KPI principal, sección 3) +
  etiqueta + periodo + delta con flecha en `accent-600` (único acento; 5.35:1
  sobre blanco). `KpiCardData` ya no lleva
  `icon`/`accent`. Entrada en cascada vía `animate-rise-up` (delay = índice).
- **Animaciones de entrada en gráficos** (2026-09-07, portado desde
  `refactor/dashboard-design`): `animate-rise-up` (filas de barras),
  `animate-grow-bar` (barra crece desde la izquierda, `origin-left`),
  `animate-draw-line` (línea de gráfico se dibuja a sí misma vía
  `pathLength=1` + `strokeDasharray=1`). Tokens en `tailwind.config.js`;
  respetan `prefers-reduced-motion` vía `globals.css`.

---

## 12. Trazabilidad de requerimientos

Fuente: `requerimientos.md` (documento del proyecto). Códigos citados en este
documento: RF-01 a RF-17 (usuarios/roles/seguridad), RF-G1-01/02/03
(georreferenciación), RF-G3-02 a RF-G3-10 (app móvil / patrullaje / puntos rojos),
RF-XX Exportación de Reportes, ESC-01/03/06 (escalabilidad).

Todo esquema de base de datos, endpoint o componente generado en Claude Code debe
referenciar el código RF/RNF correspondiente en su comentario o commit.

---

## 13. Instrucciones para Claude Code (Etapa 3)

**IMPORTANTE — este archivo por sí solo NO transmite el diseño visual.** Claude
Code no tiene acceso automático a lo generado en Claude Design; son productos
separados sin contexto compartido. Antes de la sesión en Claude Code:

1. Exportar de Claude Design los mockups/prototipos generados (capturas de
   pantalla como `.png`/`.jpg`, o el código React exportado si la herramienta
   lo permite) y guardarlos dentro del repositorio, ej. en `/design/mockups/`.
2. Confirmar que la skill `ux-ui-pro-amx` esté realmente instalada en el
   entorno de Claude Code — es una instalación independiente de la de este
   chat, no se comparte automáticamente. Si no está disponible, no es
   bloqueante: el MASTER.md ya contiene todos los tokens y reglas concretas
   necesarias, y Claude Code puede seguirlas directamente sin depender de la
   skill.
3. Al iniciar la sesión, referenciar en el prompt: (a) este archivo completo,
   y (b) la ruta a los mockups exportados del paso 1 — Claude Code necesita
   ver ambos para poder igualar el diseño visual real, no solo las reglas
   escritas.

Con eso en contexto, solicitar explícitamente:

4. Aplicar la skill `ux-ui-pro-max` (si está instalada) o, en su defecto,
   las reglas de las secciones 3-5 y 9-11 de este documento para contraste
   WCAG AA/AAA, iconografía Lucide, y microinteracciones (`duration-200`,
   focus rings).
5. Respetar los tokens de la sección 4 sin inventar nuevos colores.
6. Ubicar cada archivo generado según la estructura de carpetas de la
   sección 6 — no crear componentes fuera de su feature correspondiente ni
   duplicar componentes que ya existan en `components/ui/`.
7. Implementar los 8 estados de la sección 9 en cada componente.
8. Iterar **componente por componente** (no el dashboard completo de una vez),
   respetando la división de la sección 8, en ramas separadas por developer.
9. Verificar que el cambio de tab en el Módulo de Mapas no recargue el canvas
   base (sección 7.2).
10. Construir la capa de datos con un adaptador/interfaz intermedio (no
    componentes leyendo un mock hardcodeado directamente) — la BD real puede
    cambiar (ver nota en sección 0). El mock debe implementar la misma
    interfaz que usará la API real después.
11. Aplicar la Matriz de Visibilidad de la sección 15 estrictamente: ítems de
    nav ocultos por rol (no deshabilitados), y protección de ruta a nivel de
    middleware — nunca solo ocultar en el sidebar y confiar en eso como
    control de acceso (sección 15.5).

---

## 14. Evolución del modelo de datos — Guardias, Turnos, Rutas y Hechos

Actualización tras el diseño del schema de base de datos v3 (`schema_gamc_
seguridad_v3.sql`). Estos cambios ya están reflejados en las secciones 7.3 y
10 — esta sección explica el **por qué**, para que el equipo de diseño no
trate estos comportamientos como arbitrarios.

### 14.1 Guardia — dos estados independientes, no uno

La base de datos separa explícitamente:

| Campo | Responde a | Valores |
|---|---|---|
| `estado` (cuenta) | ¿Puede este guardia existir/loguearse? | Pendiente de activación → Activo → Inactivo |
| `estado_operativo` (tiempo real) | ¿Qué está haciendo ahora mismo? | Fuera de servicio / En servicio / Emergencia |

Son ortogonales: un guardia puede estar administrativamente "Activo" pero
operativamente "Fuera de servicio" (es de noche, no está en turno). El diseño
**debe mostrar siempre ambos badges por separado** en listados y drawers —
combinarlos en un único indicador pierde información real que el Operador
necesita para tomar decisiones.

### 14.2 Registro de guardia — credenciales generadas, no capturadas

El formulario de registro ya no incluye foto ni campos de credenciales. El
Super Admin captura únicamente datos biográficos (nombres, CI, fecha de
nacimiento, teléfono, EPI) y la base de datos genera sola:

- **Usuario:** primer nombre + 2 últimos dígitos de la CI (ej. `carlos56`)
- **Contraseña temporal:** fecha de nacimiento en formato `DDMMYYYY`

Por eso el flujo tiene una pantalla de confirmación separada (no un simple
mensaje de éxito): el usuario/contraseña generados se muestran **una sola
vez**, en texto plano, porque la base de datos nunca vuelve a exponerlos
después (se guardan hasheados). El diseño debe transmitir esa urgencia —
botón de copiar prominente, aviso claro de que esta es la única oportunidad
de ver la contraseña.

### 14.3 Turno — nuevo concepto, selfie + GPS obligatorios

El guardia inicia/finaliza su turno desde el móvil con una foto tipo selfie y
su ubicación GPS — esto no existía en el diseño original. Es un evento
repetible con historial (un guardia acumula muchos turnos), no un valor
único. Impacta el drawer de detalle: ahora debe mostrar hora de inicio/fin
del turno actual, no solo la posición en el mapa.

### 14.4 Rutas — plantillas reutilizables además de dibujo libre

Antes el Operador solo dibujaba rutas desde cero. Ahora existe una biblioteca
de rutas predefinidas (`ruta_plantilla`) — para el 10/09 poblada con
placeholders, reemplazables después por las rutas oficiales de la alcaldía
sin tocar el frontend. El modal de asignación debe ofrecer ambos caminos
claramente diferenciados, no ocultar la opción de plantilla dentro del flujo
de dibujo libre.

### 14.5 Hecho — el Operador ahora puede cambiar su estado

Originalmente el drawer de detalle de hecho era de solo lectura. Ahora el
Operador puede cambiar el estado (Abierto → En Proceso → Resuelto) desde un
desplegable — la automatización completa de este flujo según el proceso real
queda para después del 10/09, por ahora es control manual.

### 14.6 Punto crítico — dirección real en el mapa de calor

El panel de "Puntos Rojos" debe mostrar una dirección aproximada legible
(tomada de lo que el guardia escribió al reportar el hecho), no solo
coordenadas crudas — esto cierra un vacío que tenía el diseño original
respecto al requerimiento de Grupo 4 ("mostrando la ubicación exacta, ej.
intersección de calles o avenidas").

---

## 15. Matriz de Visibilidad y Lógica por Rol — MVP Demo

Recorte de alcance confirmado para la demo preliminar (BD con datos
fabricados, antes de recibir el schema definitivo). Esta sección es la
fuente de verdad para qué construye Claude Code en esta pasada — cualquier
pantalla no listada acá NO se construye todavía, aunque exista como
requerimiento documentado en `requerimientos.md`.

### 15.1 Qué ve y qué puede hacer cada rol

| Función | Super Admin | Admin | Operador |
|---|---|---|---|
| Dashboard | ✅ (compartido, ver 15.3) | ✅ (compartido, ver 15.3) | ✅ (compartido, ver 15.3) |
| Generar Credenciales (Operador/Guardia/Admin) | ✅ único que la ve | ❌ | ❌ |
| Gestión de Guardias — ver listado | ✅ | ✅ | ✅ solo lectura |
| Gestión de Guardias — editar | ✅ | ✅ | ❌ |
| Gestión de Guardias — activar/desactivar | ✅ | ✅ | ❌ |
| Gestión de Guardias — crear | ❌ (vive en Generar Credenciales) | ❌ | ❌ |
| Módulo de Mapas (Patrullaje/Calor/Futuro) | ✅ | ❌ | ✅ |
| Asignar/modificar rutas | ❌ | ❌ | ✅ |
| Hechos/Reportes — ver | ✅ | ❌ | ✅ |
| Hechos/Reportes — cambiar estado | ✅ | ❌ | ✅ |
| Gestión de Usuarios (cuentas web) | ❌ fuera de alcance MVP | ❌ fuera de alcance MVP | ❌ |
| Roles y Permisos | ❌ fuera de alcance MVP | ❌ fuera de alcance MVP | ❌ |
| Auditoría | ❌ fuera de alcance MVP | ❌ fuera de alcance MVP | ❌ |

### 15.2 Por qué estos cortes (no son arbitrarios)

- **Auditoría, Roles y Permisos, Gestión de Usuarios:** existen como
  requerimiento (RF-05, RF-06, RF-14) y como tablas reales en la base de
  datos (`role`, `role_permission`, `audit_log`, `"user"`) — se recortan
  **solo de esta demo por tiempo**, no del alcance final del proyecto. No
  eliminar las tablas ni la lógica de permisos del backend por este corte;
  solo no se construye la pantalla todavía.
- **"Crear" en Gestión de Guardias:** se retira porque duplicaría
  "Generar Credenciales", que ya cubre el alta completa (biografía + usuario
  + contraseña generados). Un solo punto de entrada para crear evita
  inconsistencia de flujo.
- **Operador de Monitoreo NO ve Guardias en modo editable:** solo necesita
  saber quién está disponible para asignar una ruta — no gestiona el
  personal.
- **Super Admin/Admin NO ven Mapas/Hechos/Patrullas (Opción A):**
  confirmado explícitamente — `requerimientos.md` no les asigna esa función,
  es exclusiva del Operador de Monitoreo. Si esto cambia más adelante, la
  reactivación es solo agregar filas a `role_permission` + volver a mostrar
  los ítems de nav — la arquitectura ya lo soporta sin rediseño.

### 15.3 Nota sobre el Dashboard compartido

El Dashboard Shell ya construido se mantiene igual para los 3 roles en este
MVP (decisión explícita: no rediseñar antes de la demo). Esto genera una
inconsistencia leve y consciente: sus KPIs actuales (Patrullas Activas,
Hechos Abiertos) son datos operativos que Super Admin/Admin en teoría no
deberían ver según la Opción A de la sección 15.1. **Se acepta esta
inconsistencia para el avance de mañana** — queda anotada acá para no
perderla de vista y revisarla en una iteración posterior (ej. Super
Admin/Admin podrían recibir un dashboard con KPIs administrativos —
guardias activos, pendientes de activación, altas recientes — en vez del
operativo).

### 15.4 Decisión pendiente — credenciales de Operador/Administrador

La generación automática de usuario/contraseña para **Guardia** ya está
definida (sección 14.2: nombre + 2 últimos dígitos de CI / fecha de
nacimiento). **No existe todavía una regla equivalente para Operador o
Administrador** — esos se crean con email, no con el mismo patrón.

Para no bloquear la demo de mañana, se asume por defecto: usuario = email
ingresado por Super Admin, contraseña temporal generada aleatoriamente y
mostrada una sola vez (mismo patrón visual de la pantalla de confirmación
que ya existe para Guardia). **Esto es una asunción de diseño, no una
decisión técnica cerrada** — confirmar o ajustar la regla real antes de que
Claude Code la implemente contra la base de datos definitiva.

### 15.5 Defensa en profundidad — regla no negociable

Ocultar un ítem del sidebar es una mejora de experiencia, **no es control de
acceso real**. Todo endpoint/Server Action debe validar el rol del usuario
autenticado en el backend antes de ejecutar cualquier acción, sin importar
si el frontend ya ocultó el botón correspondiente. Si alguien fuerza una URL
a la que su rol no tiene acceso (ej. Admin navegando directo a `/mapas`),
el middleware de Next.js debe redirigir a `/dashboard` con un mensaje claro
— nunca renderizar la página y fallar silenciosamente al pedir datos.