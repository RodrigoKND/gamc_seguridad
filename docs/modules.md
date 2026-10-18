# Módulos funcionales

Descripción de cada módulo del sistema, sus capacidades y sus componentes principales.

---

## Dashboard

**Ruta**: `/dashboard`  
**Acceso**: Super Admin, Admin

Panel ejecutivo con indicadores de desempeño y gráficas de tendencias para la toma de decisiones operativas.

### Contenido

| Sección | Descripción |
|---|---|
| KPIs en tiempo real | Total de guardias activos, incidentes del día, alertas SOS activas, patrullajes en curso |
| Gráfica de hechos por día | Serie temporal de los últimos 30 días |
| Hechos por tipo | Distribución: atraco, robo de vehículo, hurto, violencia, emergencia, otro |
| Hechos por EPI | Mapa de calor por estación policial |
| Actividad por turno | Guardias por horario (mañana / tarde / noche) |

### Datos

Los datos del dashboard se obtienen de los endpoints `/api/dashboard/kpis` y `/api/dashboard/series/*`. Se cachean con el tag `dashboard` y se invalidan cada vez que un hecho cambia de estado.

---

## Mapa (`mapas`)

**Ruta**: `/mapas`  
**Acceso**: Todos los roles

Módulo central de monitoreo. Muestra en tiempo real el estado operativo del territorio.

### Capas del mapa

| Capa | Descripción | Actualización |
|---|---|---|
| Guardias | Marcadores con estado operativo (activo / emergencia / fuera de servicio) y batería | Socket.IO `guardia:ubicacion` |
| SOS activos | Marcador especial con pulso animado en la posición del guardia que emitió la alerta | Socket.IO `sos:nuevo` |
| Zonas críticas | Círculos de calor sobre áreas con concentración de incidentes | Polling 60 s |
| Rutas en ejecución | Polilíneas de patrullaje activo con estado (incorporando / en ruta / advertencia / alerta) | Socket.IO `patrulla:estado_ruta` |
| Puntos fijos | Marcadores de estaciones de servicio con ocupación actual | Socket.IO `punto_fijo:actualizado` |
| Polígonos EPI | Delimitación territorial de cada estación policial integral | Estático (catálogo) |

### Acciones disponibles

- **Asignar ruta**: seleccionar guardia → seleccionar plantilla de ruta → confirmar asignación.
- **Cancelar ruta**: seleccionar patrullaje activo → cancelar.
- **Atender SOS**: seleccionar alerta → marcar como atendida (Operador Monitoreo).
- **Crear ruta dinámica**: dibujar trazado en el mapa → guardar como plantilla.
- **Ver detalle de guardia**: clic en marcador → drawer lateral con telemetría, batería, turno activo.

### Banner global de SOS

El componente `GlobalSosBanner` (en el layout de dashboard) muestra una barra fija de alerta cuando hay una o más alertas SOS sin atender, independientemente del módulo activo.

---

## Guardias

**Ruta**: `/guardias`  
**Acceso**: Todos los roles (escritura: Super Admin y Admin)

Gestión del catálogo de guardias municipales y su estado operativo.

### Funcionalidades

- Listado con filtros por EPI, estado operativo y estado de activación.
- Paginación del lado del servidor.
- Alta de nuevo guardia (nombre, CI, EPI asignada, teléfono, foto).
- Edición de datos del guardia existente.
- Visualización del historial de telemetría GPS del guardia seleccionado.
- Exportación del listado en CSV.

### Estados del guardia

| Estado | Descripción |
|---|---|
| `pendiente_activacion` | Registrado pero sin primer login en la app móvil |
| `activo` | Ha iniciado sesión al menos una vez |
| `inactivo` | Dado de baja operativamente |

### Estados operativos

| Estado | Descripción |
|---|---|
| `fuera_de_servicio` | Sin turno activo, no aparece en mapa |
| `en_servicio` | Con turno abierto, visible en mapa |
| `emergencia` | SOS activo — marcador especial en mapa |

---

## Hechos (Incidentes)

**Ruta**: `/hechos`  
**Acceso**: Todos los roles (cambio de estado: solo Operador Monitoreo)

Registro y gestión del ciclo de vida de los incidentes reportados desde la app móvil o ingresados manualmente.

### Flujo de estado de un hecho

```
abierto  →  en_proceso  →  resuelto
```

### Tipos de incidente

`atraco` · `robo_vehículo` · `robo_domicilio` · `hurto` · `violencia` · `emergencia` · `otro`

### Niveles de riesgo

| Nivel | Token de color |
|---|---|
| Bajo | `risk-low` |
| Medio | `risk-medium` |
| Alto | `risk-high` |
| Muy alto | `risk-critical` |

### Funcionalidades

- Listado con filtros por estado, tipo, nivel de riesgo, EPI y rango de fechas.
- Clasificación de hechos sin EPI asignada (asignar a la estación correspondiente).
- Cambio de estado del incidente (solo Operador Monitoreo).
- Vista de detalle con evidencia fotográfica y geolocalización.
- Exportación en CSV.

---

## Reportes

**Ruta**: `/reportes`  
**Acceso**: Todos los roles

Generación y descarga de reportes operativos en diferentes formatos.

### Reportes disponibles

| Reporte | Formato | Filtros |
|---|---|---|
| Guardias | CSV | EPI, estado, rango de fechas |
| Hechos | CSV / PDF | Tipo, estado, EPI, rango de fechas |
| Patrullajes | CSV | EPI, modalidad, rango de fechas |
| Actividad por turno | CSV | EPI, rango de fechas |

---

## Credenciales

**Ruta**: `/credenciales`  
**Acceso**: Solo Super Admin

Gestión de cuentas de usuario web para el personal administrativo y operativo.

### Funcionalidades

- Alta de nuevos usuarios web con selección de rol.
- Generación automática de contraseña temporal (primer login forzado).
- Activación y desactivación de cuentas existentes.
- Visualización del listado de usuarios activos con su rol y estado.

> El Operador Monitoreo y el Admin no tienen acceso a este módulo. La creación de cuentas es exclusiva del Super Admin para mantener control centralizado de accesos.
