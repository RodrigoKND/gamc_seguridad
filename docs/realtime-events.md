# Eventos en tiempo real (Socket.IO)

Catálogo de eventos WebSocket emitidos por el servidor `gamc-api` y consumidos por esta aplicación.

La conexión Socket.IO se gestiona en `src/lib/api/realtime.ts`. La autenticación del handshake usa un ticket temporal de un solo uso obtenido de `src/lib/api/realtimeTicket.ts`.

---

## Conexión

```ts
import { getSocket } from '@/lib/api/realtime'

const socket = getSocket()

socket.on('connect', () => {
  console.log('Conectado al servidor de eventos')
})

socket.on('disconnect', (reason) => {
  // El sistema activa polling de respaldo automáticamente
})
```

El socket es un **singleton** — no crear instancias adicionales. Todos los módulos que necesiten eventos deben suscribirse al mismo socket.

---

## Eventos de guardias

### `guardia:ubicacion`

Emitido cuando un guardia envía una actualización de GPS desde la app móvil.

```ts
socket.on('guardia:ubicacion', (data: {
  guardia_id: number
  lat: number
  lng: number
  precision_metros: number
  bateria: number          // 0–100
  sos_activo: boolean
  sync_timestamp: string   // ISO 8601
}) => { ... })
```

**Frecuencia**: según la configuración de la app móvil (típicamente cada 15–30 segundos en servicio).  
**Módulos que lo consumen**: Mapa.

---

### `guardia:estado`

Emitido cuando cambia el estado operativo de un guardia.

```ts
socket.on('guardia:estado', (data: {
  guardia_id: number
  estado_operativo: 'fuera_de_servicio' | 'en_servicio' | 'emergencia'
  epi_id: number
}) => { ... })
```

**Módulos que lo consumen**: Mapa, Guardias.

---

## Eventos de SOS

### `sos:nuevo`

Emitido cuando un guardia activa la alerta de emergencia desde la app móvil.

```ts
socket.on('sos:nuevo', (data: {
  guardia_id: number
  guardia_nombre: string
  lat: number
  lng: number
  epi_id: number
  timestamp: string   // ISO 8601
}) => { ... })
```

**Módulos que lo consumen**: Mapa (marcador especial), Layout (GlobalSosBanner).

---

### `sos:atendido`

Emitido cuando un operador marca la alerta SOS como atendida.

```ts
socket.on('sos:atendido', (data: {
  guardia_id: number
  atendido_por: number   // user_id del operador
  timestamp: string
}) => { ... })
```

**Módulos que lo consumen**: Mapa, Layout (GlobalSosBanner).

---

## Eventos de hechos

### `hecho:actualizado`

Emitido cuando un incidente es creado, clasificado o cambia de estado.

```ts
socket.on('hecho:actualizado', (data: {
  hecho_id: number
  estado: 'abierto' | 'en_proceso' | 'resuelto'
  epi_id: number | null
  nivel_riesgo: 'bajo' | 'medio' | 'alto' | 'muy_alto'
}) => { ... })
```

**Módulos que lo consumen**: Hechos, Dashboard, Mapa (zonas críticas).

---

## Eventos de patrullaje

### `patrulla:asignada`

Emitido cuando se asigna una ruta de patrullaje a un guardia.

```ts
socket.on('patrulla:asignada', (data: {
  ejecucion_id: number
  guardia_id: number
  ruta_plantilla_id: number
  trazado: [number, number][]  // [lng, lat][]
  modalidad: string
}) => { ... })
```

**Módulos que lo consumen**: Mapa.

---

### `patrulla:cancelada`

Emitido cuando se cancela un patrullaje activo.

```ts
socket.on('patrulla:cancelada', (data: {
  ejecucion_id: number
  guardia_id: number
  cancelado_por: number   // user_id
}) => { ... })
```

---

### `patrulla:estado_ruta`

Emitido periódicamente por el servidor con el estado calculado de cada patrullaje activo.

```ts
socket.on('patrulla:estado_ruta', (data: {
  ejecucion_id: number
  guardia_id: number
  estado_ruta: 'incorporando' | 'en_ruta' | 'advertencia' | 'alerta'
  distancia_ruta_m: number
  incorporada_en: string | null
}) => { ... })
```

| Estado ruta | Descripción |
|---|---|
| `incorporando` | El guardia se está dirigiendo al inicio de la ruta |
| `en_ruta` | El guardia está dentro del corredor de la ruta |
| `advertencia` | El guardia se alejó del corredor (distancia moderada) |
| `alerta` | El guardia se alejó significativamente o superó el tiempo límite |

**Módulos que lo consumen**: Mapa (color del trazado).

---

## Eventos de puntos fijos

### `punto_fijo:actualizado`

Emitido cuando cambia la ocupación o estado de un punto fijo de servicio.

```ts
socket.on('punto_fijo:actualizado', (data: {
  punto_fijo_id: number
  ocupacion_actual: number
  capacidad: number
  epi_id: number
}) => { ... })
```

**Módulos que lo consumen**: Mapa.

---

## Eventos de programación

### `programacion:actualizada`

Emitido cuando se modifica la programación de rutas de una EPI.

```ts
socket.on('programacion:actualizada', (data: {
  epi_id: number
  fecha: string   // YYYY-MM-DD
}) => { ... })
```

**Módulos que lo consumen**: Mapa (sección de programación).

---

## Manejo de desconexión

```ts
socket.on('disconnect', (reason) => {
  // reason: 'transport close' | 'transport error' | 'server namespace disconnect' | ...
})

socket.on('reconnect', (attempt) => {
  // Socket.IO reconecta automáticamente
  // Los módulos reciben datos frescos via polling de respaldo mientras tanto
})
```

Socket.IO intenta reconectar automáticamente con backoff exponencial. Los módulos que dependen de eventos en tiempo real tienen un polling de respaldo que se activa cuando el socket no está disponible.
