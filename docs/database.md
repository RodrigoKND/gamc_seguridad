# Esquema de base de datos

Documentación del esquema PostgreSQL de `gamc-api`. El archivo fuente se encuentra en `database/schema.sql`.

---

## Visión general

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│    user     │     │     guardia      │     │  guardia_telemetria│
│  (web app)  │     │  (app móvil)     │────►│  (GPS + batería)   │
└──────┬──────┘     └────────┬─────────┘     └────────────────────┘
       │                     │
       │              ┌──────┴──────────────────────┐
       │              │                             │
       ▼              ▼                             ▼
┌──────────┐   ┌─────────────┐            ┌──────────────────┐
│   role   │   │   patrulla  │            │      turno       │
│ role_perm│   │ (asignación)│            │  (clock-in/out)  │
└──────────┘   └──────┬──────┘            └──────────────────┘
                      │
         ┌────────────┴──────────────┐
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  ruta_plantilla │         │  ruta_ejecucion │
│  (biblioteca)   │         │  (instancia)    │
└─────────────────┘         └─────────────────┘

┌──────┐   ┌──────────────┐   ┌────────────────────┐
│ epi  │──►│    hecho     │   │  zona_critica_activa│
│      │   │ (incidentes) │──►│  (hotspots agrega.) │
└──────┘   └──────────────┘   └────────────────────┘

┌─────────────┐   ┌──────────────────────┐
│ punto_fijo  │   │  programacion_ruta   │
│ (servicio)  │   │  (calendario rutas)  │
└─────────────┘   └──────────────────────┘
```

---

## Tablas

### `user` — Usuarios web

Cuentas de acceso a la plataforma web para personal administrativo y operativo.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | Identificador único |
| `role_id` | `int FK → role` | Rol asignado |
| `email` | `varchar unique` | Correo electrónico |
| `usuario` | `varchar unique` | Nombre de usuario |
| `password_hash` | `text` | Contraseña hasheada (bcrypt) |
| `estado` | `varchar` | `activo`, `inactivo` |
| `primer_login_requerido` | `boolean` | Si debe cambiar contraseña al primer ingreso |
| `primer_nombre` | `varchar` | — |
| `segundo_nombre` | `varchar nullable` | — |
| `apellido_paterno` | `varchar` | — |
| `apellido_materno` | `varchar nullable` | — |
| `ci` | `varchar` | Cédula de identidad |
| `telefono` | `varchar nullable` | — |
| `fecha_nacimiento` | `date nullable` | — |

---

### `role` / `role_permission` — Roles y permisos

Roles del sistema (valores fijos, no modificables desde la UI):

| `id` | `nombre` |
|---|---|
| 1 | `super_admin` |
| 2 | `admin` |
| 3 | `operador_monitoreo` |

`role_permission` define qué operaciones puede hacer cada rol sobre cada recurso:

| Columna | Tipo |
|---|---|
| `role_id` | `int FK → role` |
| `recurso` | `varchar` |
| `puede_ver` | `boolean` |
| `puede_crear` | `boolean` |
| `puede_editar` | `boolean` |
| `puede_eliminar` | `boolean` |

---

### `guardia` — Guardias municipales

Usuarios de la aplicación móvil.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | — |
| `epi_id` | `int FK → epi` | EPI a la que pertenece |
| `nombre` | `varchar` | Nombre completo generado |
| `ci` | `varchar unique` | Cédula de identidad |
| `usuario` | `varchar unique` | Usuario para la app móvil |
| `password_hash` | `text` | — |
| `telefono` | `varchar nullable` | — |
| `foto_url` | `text nullable` | URL de foto de perfil |
| `estado` | `varchar` | `pendiente_activacion`, `activo`, `inactivo` |
| `estado_operativo` | `varchar` | `fuera_de_servicio`, `en_servicio`, `emergencia` |

---

### `guardia_telemetria` — Telemetría GPS

Tabla de solo inserción (append-only). Cada row es una muestra de ubicación de la app móvil.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `bigserial PK` | — |
| `guardia_id` | `int FK → guardia` | — |
| `lat` | `decimal(10,7)` | Latitud |
| `lng` | `decimal(10,7)` | Longitud |
| `precision_metros` | `decimal` | Precisión del GPS |
| `bateria` | `smallint` | Porcentaje de batería (0–100) |
| `sos_activo` | `boolean` | Si hay alerta activa |
| `sync_timestamp` | `timestamptz` | Timestamp del dispositivo |
| `created_at` | `timestamptz` | Timestamp de recepción |

---

### `epi` — Estaciones Policiales Integrales

Catálogo oficial de las 6 EPIs del municipio.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | — |
| `codigo` | `varchar unique` | Código oficial (EPI-1, EPI-2…) |
| `nombre` | `varchar` | Nombre completo |
| `color` | `varchar` | Color hexadecimal para visualización |
| `poligono` | `jsonb` | GeoJSON del territorio |
| `territorio` | `text` | Descripción textual del territorio |
| `sede_lat` | `decimal` | Coordenada de la sede |
| `sede_lng` | `decimal` | Coordenada de la sede |
| `telefonos` | `jsonb` | Array de teléfonos de contacto |

---

### `hecho` — Incidentes

Incidentes de seguridad reportados desde la app móvil o ingresados manualmente.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `bigserial PK` | — |
| `tipo` | `varchar` | `atraco`, `robo_vehículo`, `robo_domicilio`, `hurto`, `violencia`, `emergencia`, `otro` |
| `descripcion` | `text nullable` | Descripción del incidente |
| `lat` | `decimal(10,7)` | Ubicación |
| `lng` | `decimal(10,7)` | — |
| `ubicacion_direccion` | `text nullable` | Dirección aproximada |
| `epi_id` | `int nullable FK → epi` | EPI responsable (null si no clasificado) |
| `estado` | `varchar` | `abierto`, `en_proceso`, `resuelto` |
| `nivel_riesgo` | `varchar` | `bajo`, `medio`, `alto`, `muy_alto` |
| `foto_url` | `text nullable` | Foto principal |
| `evidencia` | `jsonb nullable` | Array de evidencias `{tipo, url}` |
| `reportado_por` | `int nullable FK → guardia` | Guardia que reportó |
| `created_at` | `timestamptz` | — |
| `updated_at` | `timestamptz` | — |

---

### `patrulla` — Asignaciones de patrullaje

Vínculo entre un guardia y una ejecución de ruta.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | — |
| `guardia_id` | `int FK → guardia` | — |
| `ruta_plantilla_id` | `int nullable FK → ruta_plantilla` | — |
| `ejecucion_id` | `int FK → ruta_ejecucion` | — |
| `estado` | `varchar` | `activa`, `cancelada`, `completada` |
| `modalidad` | `varchar` | `a_pie`, `vehicular`, `bicicleta` |
| `estado_ruta` | `varchar` | `incorporando`, `en_ruta`, `advertencia`, `alerta` |
| `distancia_ruta_m` | `decimal nullable` | Distancia a la ruta en metros |
| `incorporada_en` | `timestamptz nullable` | Momento en que se incorporó a la ruta |
| `incorporacion_limite` | `timestamptz nullable` | Plazo límite para incorporarse |

---

### `ruta_plantilla` — Biblioteca de rutas

Plantillas reutilizables de rutas de patrullaje.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | — |
| `nombre` | `varchar` | — |
| `descripcion` | `text nullable` | — |
| `epi_id` | `int FK → epi` | — |
| `tipo` | `varchar` | `establecida`, `guardada`, `dinamica` |
| `trazado` | `jsonb` | Array de coordenadas `[lng, lat][]` |
| `duracion_min` | `int` | Duración estimada en minutos |
| `capacidad` | `int` | Número de guardias que puede tomar la ruta |
| `modalidad` | `varchar` | `a_pie`, `vehicular`, `bicicleta` |

---

### `turno` — Turnos de servicio

Registro de entradas y salidas (clock-in / clock-out) de los guardias.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | — |
| `guardia_id` | `int FK → guardia` | — |
| `hora_inicio` | `timestamptz` | Inicio del turno |
| `hora_fin` | `timestamptz nullable` | Fin del turno (null si aún activo) |
| `selfie_inicio_url` | `text nullable` | Foto de inicio de turno |
| `selfie_fin_url` | `text nullable` | Foto de fin de turno |
| `lat_inicio` | `decimal nullable` | Ubicación al inicio |
| `lng_inicio` | `decimal nullable` | — |
| `lat_fin` | `decimal nullable` | Ubicación al terminar |
| `lng_fin` | `decimal nullable` | — |
| `estado` | `varchar` | `activo`, `cerrado` |

---

### `punto_fijo` — Puntos fijos de servicio

Estaciones de servicio y puntos de descanso asignados a EPIs.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | — |
| `nombre` | `varchar` | — |
| `lat` | `decimal` | — |
| `lng` | `decimal` | — |
| `epi_id` | `int FK → epi` | — |
| `capacidad` | `int` | Número máximo de guardias |
| `es_principal` | `boolean` | Si es el punto principal de la EPI |

---

### `zona_critica_activa` — Zonas críticas

Hotspots calculados automáticamente a partir de la concentración de incidentes.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | — |
| `centro_lat` | `decimal` | Centro del área crítica |
| `centro_lng` | `decimal` | — |
| `radio_metros` | `decimal` | Radio del área |
| `direccion_aproximada` | `text nullable` | — |
| `conteo_hechos` | `int` | Número de incidentes en el área |
| `nivel_riesgo_predominante` | `varchar` | Nivel de riesgo dominante |
| `epi_id` | `int FK → epi` | — |
| `updated_at` | `timestamptz` | — |

---

### `programacion_ruta` — Programación

Asignación calendárica de rutas a bloques horarios.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `serial PK` | — |
| `ruta_plantilla_id` | `int FK → ruta_plantilla` | — |
| `fecha` | `date` | Fecha programada |
| `hora_inicio` | `time` | Inicio del bloque |
| `hora_fin` | `time` | Fin del bloque |
| `modalidad` | `varchar` | — |
| `capacidad` | `int` | Guardias requeridos |
| `asignacion_automatica` | `boolean` | Si el sistema asignará automáticamente |

---

## Convenciones del esquema

- Todas las tablas tienen `created_at timestamptz DEFAULT now()` implícito.
- Las tablas de solo inserción (`guardia_telemetria`) no tienen `updated_at`.
- Los campos de coordenadas usan `decimal(10,7)` para máxima precisión GPS.
- Los campos GeoJSON se almacenan como `jsonb` (no se usa la extensión PostGIS).
- Los enumerados se implementan como `varchar` con restricciones `CHECK` para facilitar migraciones.

El archivo completo con definiciones, índices y comentarios está en `database/schema.sql`.
