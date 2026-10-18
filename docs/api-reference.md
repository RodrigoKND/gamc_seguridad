# Referencia de API REST

Documentación de los endpoints del backend `gamc-api` consumidos por esta aplicación.

Todos los endpoints requieren autenticación mediante cookie `gamc_access` (JWT) salvo los marcados como públicos. Los endpoints de mutación también requieren el header `X-XSRF-Token` con el valor de la cookie `gamc_xsrf`.

**Base URL**: `NEXT_PUBLIC_API_BASE_URL` (configurado en `.env.local`)

---

## Autenticación

### `POST /api/auth/login` — Público

Autenticar un usuario web.

**Body**:
```json
{
  "identifier": "usuario@gamc.bo",
  "password": "contraseña"
}
```

**Respuesta exitosa** `200 OK`: establece cuatro cookies httpOnly:
- `gamc_access` — JWT de acceso (15 min)
- `gamc_refresh` — Token de rotación
- `gamc_profile` — Datos del usuario en caché
- `gamc_xsrf` — Token anti-CSRF

---

### `POST /api/auth/refresh`

Renovar el token de acceso usando el refresh token.

**Respuesta exitosa** `200 OK`: rota el refresh token y emite un nuevo `gamc_access`.

---

### `POST /api/auth/logout`

Revocar la sesión activa. Borra todas las cookies de sesión.

---

## Usuarios web

### `GET /api/usuarios`

Listar usuarios web. Solo accesible por `super_admin`.

**Query params**:
| Parámetro | Tipo | Descripción |
|---|---|---|
| `rol` | string | Filtrar por rol (`super_admin`, `admin`, `operador_monitoreo`) |
| `estado` | string | Filtrar por estado (`activo`, `inactivo`) |

---

### `POST /api/usuarios`

Crear un nuevo usuario web. Solo `super_admin`.

**Body**:
```json
{
  "email": "operador@gamc.bo",
  "usuario": "jperez",
  "rol": "operador_monitoreo",
  "primer_nombre": "Juan",
  "apellido_paterno": "Pérez",
  "ci": "12345678"
}
```

---

## Guardias

### `GET /api/guardias`

Listar guardias con paginación y filtros.

**Query params**:
| Parámetro | Tipo | Descripción |
|---|---|---|
| `epi_id` | number | Filtrar por EPI |
| `estado` | string | `pendiente_activacion`, `activo`, `inactivo` |
| `estado_operativo` | string | `fuera_de_servicio`, `en_servicio`, `emergencia` |
| `page` | number | Número de página (default: 1) |
| `per_page` | number | Registros por página (default: 20, max: 100) |

---

### `POST /api/guardias`

Crear un nuevo guardia.

**Body**: `multipart/form-data` con campos: `nombre`, `ci`, `epi_id`, `telefono`, `foto` (archivo).

---

### `PATCH /api/guardias/:id`

Actualizar datos de un guardia existente.

---

### `GET /api/guardias/:id/telemetria`

Obtener historial de telemetría GPS del guardia.

**Query params**: `desde`, `hasta` (ISO 8601), `limit`.

---

### `POST /api/guardias/:id/sos/atender`

Marcar la alerta SOS del guardia como atendida. Solo `operador_monitoreo`.

---

## Mapas y patrullaje

### `GET /api/mapas/ubicaciones`

Obtener las últimas ubicaciones GPS de todos los guardias en servicio.

**Respuesta**: array de `{ guardia_id, lat, lng, estado_operativo, bateria, sos_activo, sync_timestamp }`.

---

### `GET /api/mapas/rutas`

Listar plantillas de ruta disponibles.

**Query params**: `epi_id`, `tipo` (`establecida`, `guardada`, `dinamica`), `modalidad`.

---

### `POST /api/mapas/rutas`

Crear una nueva plantilla de ruta.

**Body**:
```json
{
  "nombre": "Ruta Norte - Patrullaje vehicular",
  "epi_id": 2,
  "tipo": "establecida",
  "modalidad": "vehicular",
  "trazado": [[-66.165, -17.390], [-66.162, -17.388]],
  "duracion_min": 45,
  "capacidad": 2
}
```

---

### `POST /api/mapas/ejecuciones`

Asignar una ruta a uno o más guardias.

**Body**:
```json
{
  "ruta_plantilla_id": 5,
  "guardia_ids": [12, 14],
  "modalidad": "a_pie"
}
```

---

### `POST /api/mapas/ejecuciones/:id/cancelar`

Cancelar un patrullaje en curso.

---

### `GET /api/mapas/puntos-fijos`

Listar puntos fijos de servicio.

**Query params**: `epi_id`.

---

### `POST /api/mapas/puntos-fijos`

Crear un nuevo punto fijo.

---

## Hechos (Incidentes)

### `GET /api/hechos`

Listar incidentes con paginación y filtros.

**Query params**:
| Parámetro | Tipo | Descripción |
|---|---|---|
| `estado` | string | `abierto`, `en_proceso`, `resuelto` |
| `tipo` | string | Tipo de incidente |
| `epi_id` | number | Filtrar por EPI |
| `nivel_riesgo` | string | `bajo`, `medio`, `alto`, `muy_alto` |
| `desde` | ISO 8601 | Fecha de inicio del rango |
| `hasta` | ISO 8601 | Fecha de fin del rango |
| `page` | number | Número de página |
| `per_page` | number | Registros por página |

---

### `PATCH /api/hechos/:id/clasificar`

Asignar un hecho a una EPI.

**Body**:
```json
{ "epi_id": 3 }
```

---

### `PATCH /api/hechos/:id/estado`

Cambiar el estado de un hecho. Solo `operador_monitoreo`.

**Body**:
```json
{ "estado": "en_proceso" }
```

---

## Dashboard y analítica

### `GET /api/dashboard/kpis`

Obtener indicadores clave del día actual.

**Respuesta**:
```json
{
  "guardias_activos": 24,
  "hechos_hoy": 7,
  "sos_activos": 1,
  "patrullajes_activos": 8
}
```

---

### `GET /api/dashboard/series/hechos-por-dia`

Serie temporal de incidentes de los últimos N días.

**Query params**: `dias` (default: 30).

---

### `GET /api/dashboard/series/hechos-por-tipo`

Distribución de incidentes por tipo.

---

### `GET /api/dashboard/series/hechos-por-epi`

Distribución de incidentes por EPI.

---

## EPIs

### `GET /api/epis`

Listar todas las EPIs con sus polígonos territoriales, coordenadas de sede y datos de contacto.

---

### `GET /api/epis/modulos`

Listar los módulos policiales dependientes de cada EPI.

---

## Programación de rutas

### `GET /api/programacion`

Obtener la programación de rutas para una fecha o rango de fechas.

**Query params**: `fecha`, `epi_id`.

---

### `POST /api/programacion`

Crear o actualizar un bloque de programación.

---

## Códigos de error comunes

| Código | Significado |
|---|---|
| `400 Bad Request` | Parámetros inválidos o faltantes |
| `401 Unauthorized` | Token expirado o ausente — el cliente debe refrescar |
| `403 Forbidden` | El rol del usuario no tiene permiso para esta operación |
| `404 Not Found` | Recurso no encontrado |
| `409 Conflict` | Conflicto de datos (ej: CI ya registrada) |
| `422 Unprocessable Entity` | Validación de negocio fallida |
| `500 Internal Server Error` | Error interno del servidor |
