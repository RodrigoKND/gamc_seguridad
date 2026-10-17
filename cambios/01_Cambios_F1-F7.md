# Cambios F1–F7 — qué se hizo en cada fase

Registro de los cambios del plan por fases. Todo está integrado en `redesign/integracion`
(un commit por repo). Cómo desplegarlo: `docs/entrega-f1-f7.md` (backend y base de datos)
y `cambios/Entrega-F1-F7.md` (web).

Este archivo conserva las decisiones en orden cronológico: los ajustes
posteriores de cada fase sustituyen sus propuestas iniciales. La agenda actual
muestra Hoy/Mañana; la automática reintenta cada minuto con radio inicial de
3 km y sin prioridad; «Manual» reserva hasta 5 minutos para elegir reemplazo
sin desactivar la automática.

## Resumen

| Fase | Contenido | Migración |
|---|---|---|
| F1 | Catálogo de 6 EPIs del inventario oficial | `0006_epi_catalogo_inventario` |
| F2 | Motor de asignación por ejecuciones, menú Rutas | `0007_ruta_ejecucion` |
| F3 | Segmentación por EPI, EPI actual, guardias libres | `0008_segmentacion_epi` |
| F4 | Puntos fijos y ocupación; mejoras del mapa | `0009_puntos_fijos` |
| F5 | Programación de rutas y planificador | `0010_programacion_rutas` |
| F6 | Asignación automática de horarios | `0011_asignacion_automatica` |
| F7 | Paleta del logo, ajustes visuales, plazo de incorporación | `0012_plazo_incorporacion` |

## F1 — Catálogo de 6 EPIs (08/10/2026)

### Cambios

**Base de datos — migración `0006_epi_catalogo_inventario`** (generada por `scripts/epi/generar_catalogo_v2.py` desde `scripts/epi/inventario_epis.json`):
- Aditivo: columnas nuevas en `epi` (`numero`, `nombre_oficial`, `color`, `sede_lat`, `sede_lng`, `sede_direccion`, `telefonos`), tablas `epi_territorio` (versionado; v1 = copia legado, v2 = 6 territorios vigentes) y `modulo_policial` (52 MP + FELCV), filas nuevas `jaihuayco` y `alalay_sud`.
- Excepciones aprobadas: **** `centro_cercado.activo = false`; **** nombres oficiales ("EPI Sud" → "EPI Sur", código `sud` intacto).
- Precondiciones y verificación posterior dentro de la migración (abortan si algo no cuadra). Idempotente.
- Reversión: `scripts/sql/revert/0006_epi_catalogo_inventario.revert.sql` (se detiene si hay datos que ya usan las EPIs nuevas).

**Backend**
- Módulo nuevo `src/modules/epis`: catálogo con caché (30 s), `GET /api/epis`, `GET /api/epis/modulos`, clasificación determinista de puntos (orden oficial; `fuera_cobertura` en vez de "la más cercana"; `ambigua` marcada).
- `jurisdiccion.ts`: territorio vigente de `epi_territorio`; **falla cerrado si la EPI del usuario está inactiva**; contención del **trazado completo** (segmentos muestreados cada 15 m), no solo vértices; coordenadas no finitas/fuera de rango rechazadas.
- `GET /api/guardias?epi=<desconocido>` → 200 vacío (antes 500).
- `POST/PATCH /api/usuarios`: EPI validada contra el catálogo (sin lista fija).
- `/api/dashboard/series/por-zona`: agrega `epiCodigo` (aditivo).
- `prisma/schema.prisma`: solo campos/modelos nuevos. `prisma/seed.ts`: nombres de las 6 EPIs (no reactiva Centro Cercado).

**Web**
- `types/epi.ts`: la EPI se identifica por el **código del backend**; desaparecen `EPI_ZONES`, `EPI_ZONE_LABELS`, `EPI_ZONE_HEX`, `EPI_ZONE_BG_CLASS` y la traducción a slugs (`cona`, `centro`).
- `EpiCatalogProvider` (layout del dashboard) + `EpiNombre`, `EpiPunto`, `EpiOpciones`.
- Desconocido/nulo → "Sin EPI" o el código, nunca "Centro".
- Mapa: territorios con color del catálogo en un pane propio bajo las rutas; pines numerados de las 6 sedes con popup (nombre oficial, dirección, teléfonos); capa opcional de módulos; zona de referencia **Centro – Plaza 14 de Sept.** en negro calibrado sobre Central; leyenda 1–6.
- Selects de alta (usuarios, guardias) solo con EPIs operativas; filtros con todas (históricas marcadas).
- Exportaciones PDF/CSV con nombres del catálogo. Búsqueda global del Topbar con palabras del catálogo.

### Ajustes tras la primera revisión del usuario (08/10/2026)

| Pedido | Cambio |
|---|---|
| El Centro debe abarcar solo la Plaza 14 de Septiembre completa | Contorno real de la plaza de OpenStreetMap (way 28575218, `leisure=park`, ~125 × 110 m) en lugar del rectángulo del casco viejo. Sigue siendo referencia visual, no EPI. |
| El negro era demasiado intenso; solo "Centro" | Relleno `#111827` al 35 % (translúcido como los territorios) y etiqueta "Centro". |
| El aviso "fuera de ruta" tapaba el mapa | `DesviacionesPanel`: panel lateral sobre el mapa, ordenado por distancia, que se retrae a una pestaña con el conteo (recordado por navegador). Antes era un bloque dentro de la fila del mapa que le quitaba el espacio. |

### Ajustes de pines (segunda revisión del usuario, 08/10/2026)

| Pedido | Cambio |
|---|---|
| Zoom al tocar un pin del mapa (como desde el panel derecho) | El clic en el pin usa la misma selección que el panel: abre el detalle y centra/acerca (`MapFocus`). |
| Zoom progresivo al tocar un grupo numerado | `zoomToBoundsOnClick` activado en el agrupador: acerca solo hasta que el grupo se desglosa (3 → 2 + 1 → …); el abanico queda para guardias en el mismo punto en zoom máximo. Sin código nuevo de zoom. |

## F2 — Motor de asignación (iniciada 08/10/2026)

### Decisiones del usuario antes de empezar

| Tema | Decisión |
|---|---|
| Tipos de ruta | **Establecida** (oficial, policía) y **guardada** (recurrente): parámetros editables por ruta — duración (12 h por defecto), modalidad, capacidad, nombre, descripción. **Dinámica**: sin tiempo límite; solo la cierra el usuario. |
| Turnos variables / sin operadores | Cierre por tiempo en el **servidor** (proceso cada minuto), independiente de que haya operadores conectados. Se revisará tras observar el comportamiento. |
| Fin de turno | En **todas** las rutas el guardia que cierra turno sale de su ruta; la ruta sigue con los demás y, sin nadie, desaparece del mapa en vivo. |
| GPS reciente | Asignación manual: no bloquea, solo aviso "último GPS hace X". Obligatorio en la automática (F6). |
| Desvíos | Umbrales **por modalidad**, calculados en el servidor en cada ping: 🔵 incorporándose (hasta llegar por primera vez), 🟡 advertencia, 🔴 alerta. El panel lateral muestra solo azul/amarillo/rojo (verde se da por hecho). |
| A futuro (no en F2) | Registro de abandono tras 20 min en rojo; estado "sin señal". |
| Rutas establecidas | Crear/editar: Super Admin, Admin y Operador (estos dos en su EPI), con un permiso propio (podría quitarse al Admin más adelante). |

Umbrales iniciales (configurables, propuesta de Claude): a pie 50/150 m · moto 100/300 m · coche 100/400 m · punto fijo y oficina 30/100 m (verde ≤ primer valor; amarillo ≤ segundo; rojo por encima).

### Cambios

**BD — migración `0007_ruta_ejecucion`** (aditiva + excepciones aprobadas; reversión `scripts/sql/revert/0007_ruta_ejecucion.revert.sql`):
- `ruta_plantilla`: columnas nuevas `tipo` (establecida/guardada/dinamica), `duracion_min`, `capacidad`; las existentes quedan como guardada (12 h) o dinámica.
- Tabla `ruta_ejecucion` (asignación concreta: EPI, modalidad, capacidad, trazado copiado, ventana `[inicio, fin)`, estado, motivo y autoría).
- `patrulla`: `ejecucion_id`, `modalidad`, `motivo_cierre`, `estado_ruta`, `distancia_ruta_m`, `estado_ruta_en`, `incorporada_en`.
- Tabla `operacion_idempotente`. Índice único `ux_patrulla_guardia_activa` (si hay duplicados la migración aborta con la lista).
- `v_patrulla_vigente` con las mismas columnas y vigencia por ejecución / fecha local de Bolivia.
- Permisos nuevos `sos` (Operador y Super Admin atienden; Admin solo ve) y `rutas_establecidas` (los 3 roles).
- Ejecución creada para las patrullas activas existentes.

**Backend**
- Módulo `ejecuciones`: motor de asignación grupal todo-o-nada (bloqueo de guardias en orden estable, elegibilidad, jurisdicción, capacidad acumulada, confirmación exacta de reasignaciones, idempotencia, auditoría en la misma transacción, eventos tras confirmar), cancelar ejecución, retirar guardia (cierra la ruta si queda vacía), salida de ruta por fin de turno y cierre de vencidas.
- Endpoints: `POST /api/mapas/ejecuciones/previsualizar`, `POST /api/mapas/ejecuciones`, `PATCH /api/mapas/ejecuciones/:id/cancelar`, `PATCH /api/mapas/rutas/:id` (parámetros). Compatibilidad: `POST /mapas/patrullas` y `PATCH /mapas/rutas/:id/cancelar` delegan en el motor (ya no reemplazan en silencio).
- Turnos: al iniciar se enlaza la asignación vigente; al cerrar, el guardia sale de su ruta (todas las rutas).
- Telemetría: estado respecto a la ruta por modalidad en cada ping (incorporándose → en ruta / advertencia / alerta), protegido contra pings atrasados; evento `patrulla:estado_ruta`.
- SOS: `POST /api/guardias/:id/sos/atender` (alertas exactas, estado derivado del turno, historial conservado); definición única de alerta abierta en mapa, banner, campana y KPI; `/mapas/ubicaciones` con `sosAbierto` y sin el tope de 500.
- Proceso del servidor cada minuto que cierra asignaciones vencidas (interruptor `DESACTIVAR_VENCIMIENTO_RUTAS=1`).

**Web**
- Asistente: una sola intención con clave idempotente; tipo de ruta (dinámica / guardada / establecida) y duración; aviso "ya tiene ruta" con confirmación de retiro; avisos de GPS antiguo; coche hasta 12; punto de encuentro común en coche/moto; edición de parámetros de rutas de la biblioteca.
- Mapa: rutas agrupadas por ejecución (cancelar una no cancela otra de la misma ruta guardada); permisos por la EPI de la ruta; conteos asignados / con GPS / en ruta; panel lateral con azul (incorporándose), amarillo (advertencia) y rojo (fuera de ruta) desde el servidor; detalle del guardia con el estado real (antes medía la distancia desde el inicio del trazado).
- SOS: "Atender alerta SOS" atiende las alertas vistas; la asignación ya no resuelve el SOS.
- Unidad: ya no se guarda en memoria del servidor web; sale de la ejecución.

### Ajustes tras la primera revisión del usuario (09/10/2026)

Pedido: ventana flotante reutilizable; asignación parcial; avisos en ventana flotante en vez de saturar el asistente; menú "Rutas" con 3 opciones; revisar errores de lógica del asistente.

- **Ventana flotante** `components/ui/AlertDialog.tsx` (`DialogProvider` en el layout + `useDialog().confirmar/avisar`), tonos info/éxito/advertencia/peligro, lista de detalles, Escape no cierra el modal de abajo.
- **Asignación parcial (backend):** se asigna a los aptos; `noAsignados[{guardiaId, guardiaNombre, motivo, mensaje}]` (cuenta_inactiva, sos, sin_turno, otra_epi, en_ruta_otra_epi, ya_en_esta_ruta, ruta_llena). Si nadie es apto: 400 `SIN_GUARDIAS_ASIGNABLES` y no se crea nada. Retiros sin confirmar siguen en 409.
- **Previsualización** solo con guardias (antes de dibujar), sin bloquear filas; devuelve conflictos, noAsignados y avisos GPS.
- **Biblioteca:** `POST /rutas` acepta tipo/duración/capacidad; permiso por tipo (predeterminada → `rutas_establecidas`, recurrente → `patrullaje`) — antes el Admin no podía pese a la decisión de F2; `PATCH /rutas/:id/archivar` (borrado lógico); super admin: ruta que cruza EPIs rechazada; listado con predeterminadas primero.
- **Web:** botón "Rutas" → Rutas Predeterminadas (crear), Asignar Ruta (pestañas "Modalidad" / "Usar Ruta Guardada"), Rutas Guardadas (ver en mapa, asignar, editar, archivar). Sin parámetros en el asistente; casilla "Guardar como ruta recurrente".
- **Errores de lógica corregidos en el asistente:** ruta guardada que quedaba pegada al volver y elegir modalidad; selección mayor que la capacidad al cambiar de modalidad; guardia preseleccionado de otra EPI que la ruta guardada; guardias con SOS seleccionables; se podía confirmar la línea recta mientras OSRM calculaba; duración inválida reemplazada en silencio por 12 h; conteo de éxito con los seleccionados y no los asignados; error que persistía entre pasos; ruta guardada pasaba por un paso de dibujo inútil; mini-mapa no encuadraba la ruta.


## F3 — Segmentación por EPI, EPI actual y guardias libres (09/10/2026)


### Base de datos — migración `0008_segmentacion_epi` (con reversión)
- Funciones SQL nuevas (sin PostGIS): `fn_gamc_en_anillo`, `fn_gamc_punto_en_geojson`, `fn_gamc_clasificar_punto` — misma regla que `clasificarPunto` (orden por número oficial, ambigua/fuera_cobertura).
- `hecho` y `mandado`: columnas nuevas `epi_metodo`, `epi_estado`, `epi_territorio_version`, `epi_clasificado_en` (+ `mandado.epi_id`).
- `guardia_ubicacion_actual` (tabla nueva): última posición válida + EPI actual + `epi_desde`; relleno desde el último GPS (100 guardias).
- Permisos nuevos: `dashboard` (Admin y Super Admin) y `jurisdiccion_usuarios` (solo Super Admin). ****: Operador `guardias.editar` → false, valor anterior en `permiso_cambio_registro`.

### Backend
- Alcance explícito (`alcanceDe`: global | epi | 403) en hechos (lista, total, detalle, cambio de estado, exportación), mandados, dashboard, rutas, ejecuciones/patrullas, zonas, mapa de calor, recálculo de zonas y recorridos. El filtro del cliente solo reduce.
- Hechos y mandados: EPI por SUS coordenadas al crearse; fuera de cobertura queda sin EPI y va a la bandeja (`?clasificacion=pendiente`); `PATCH /hechos/:id/epi` solo supervisión global (auditado). `GET /hechos/exportar` completo (hasta 20 000, orden estable, `truncado`).
- Telemetría: exclusiva de la app (antes un usuario web podía mandar GPS/SOS de cualquier guardia), turno propio, reloj adelantado > 5 min rechazado, EPI actual monótona (un ping atrasado no la mueve).
- Guardias libres: el motor ya no excluye por EPI del guardia; un guardia en una ruta de otra EPI sigue siendo no retirable y no se revela el nombre de esa ruta.
- Guardias: `epiActual` (EPI, estado, frescura ≤10 min, desde) y filtro `epiActual` (código, fuera_cobertura, sin_dato); conteo de reportes por guardia en el backend dentro del alcance.
- Ubicaciones (global): `epiActual` y `asignacion` (propia → nombre e id; ajena → solo "ocupado en EPI X").
- Tiempo real: salas `epi:{id}` / `epi:global`; hechos, mandados y rutas solo a su EPI y a supervisión; los guardias ya no entran al canal web; al cambiar la EPI de un usuario se cierran sus sockets.
- Usuarios: cambiar la EPI exige `jurisdiccion_usuarios` (el Admin ya no puede, ni la suya).
- Zonas: recálculo atómico con bloqueo, por EPI, y caducidad cuando no hay hechos.
- Recorridos: supervisión ve todo; una EPI solo los tramos de rutas de su EPI.

### Web
- Guardias: columna **EPI actual** (con antigüedad del GPS, "Sin GPS", "Fuera de cobertura"), filtro por EPI actual, exportaciones con EPI actual; alta y edición sin EPI fija.
- Hechos: "Por clasificar", casilla "Solo por clasificar" y clasificación manual en el detalle (solo Super Admin); exportación completa; el Historial usa todo el archivo (antes 200).
- Mapa: pin coloreado por EPI actual; asistente con guardias de todas las EPIs ("Ahora en EPI X", los de mi EPI primero; ocupados por otra EPI deshabilitados); "Ocupado · ruta de EPI X" en el panel; asignar desde el detalle de cualquier guardia.
- Dashboard: etiqueta "Datos de EPI X · SOS de todas las EPIs" para el Admin.

### Pendiente / notas
- Los permisos nuevos viajan en el JWT: un Admin ya conectado debe **volver a iniciar sesión** para ver el Dashboard (antes de eso responde 403).
- Caché de lecturas de la web (Next, 15–60 s) tras cambiar la EPI de un usuario: la jurisdicción y los sockets cambian al instante, algunas listas pueden tardar hasta 1 min.
- No se generó el informe de plantillas que cruzan territorios — en la BD actual todas se crearon con contención completa.


## F4 — Puntos fijos y ocupación (16/10/2026)


### Decisiones (propuestas de Claude aceptadas por el usuario con «bien, empieza»)
| Tema | Decisión |
|---|---|
| Capacidad (Rol de Servicio 02/09) | Cristo Seguro 4 (Plataforma 2 + Inicio de gradas 2), La Coronilla 2, Plaza Principal 2, Plaza Colón 2, Pasaje Portales 1, Edificio Municipal 2 |
| Padre / subpuntos | La capacidad del punto = suma de sus subpuntos activos. Asignar al punto sin elegir subpunto → el de más cupo libre. Un solo nivel de subpuntos. |
| Oficinas Queru Queru | No es punto fijo; sigue en la modalidad «oficina». |
| Coordenadas | Aproximadas de OpenStreetMap (Photon), marcadas «aproximada»; se corrigen desde la web. |
| Punto ocupado | Mover → elegir trasladar o retirar; desactivar o cambiar de EPI → retirar; bajar la capacidad por debajo de los asignados → rechazado. |

**Pendiente de confirmar:** con los territorios aproximados, la Plataforma del Cristo cae en EPI Norte y el Inicio de gradas en EPI Central. Regla aplicada: la EPI del punto la decide su coordenada principal (el monumento → **Norte**) y los subpuntos la heredan. El Super Admin puede fijar otra EPI a mano desde «Puntos Fijos». Pasaje Portales también queda en Norte; los demás, en Central.

### Base de datos — migración `0009_puntos_fijos` (solo aditiva, con reversión)
- Tablas `punto_fijo` (un nivel de subpuntos, EPI y método, capacidad, aproximada, origen, versión) y `punto_fijo_version` (historial con política y guardias afectados).
- `ruta_ejecucion.punto_fijo_id` + `destino` (copia del destino) y `patrulla.punto_fijo_id` (hoja). Índice único: una ejecución abierta por punto.
- Permiso `puntos_fijos`: Super Admin y Operador administran; el Admin solo ve.
- Catálogo inicial: 6 puntos + 2 subpuntos del Rol de Servicio, EPI calculada en SQL (`fn_gamc_clasificar_punto`).

### Backend
- Módulo `puntos-fijos`: `GET /api/puntos-fijos` (ocupación contada en el servidor; nombres y ejecución solo dentro del alcance), `POST`, `PATCH /:id` (con `politicaOcupados`), `GET /:id/historial`. Evento `punto_fijo:actualizado`.
- Motor (F2): `POST /mapas/ejecuciones` acepta `puntoFijoId` (y `guardias[].puntoFijoId` por subpunto). Asigna por la identidad del punto, sin trazado. Reparte por hoja con el cupo real y bloquea la raíz del punto. Motivo nuevo `punto_lleno`.
- Telemetría: en un punto fijo, el estado (incorporándose / en su punto / advertencia / alerta) se mide a la coordenada del (sub)punto, con umbrales de 30/100 m.
- App móvil sin cambios: recibe `trazado: null` y el punto (`poligonoGeojson` Point) que ya sabe dibujar.

### Web
- Pines permanentes con bandera, color de EPI y ocupación «n/cap» (verde, ámbar o rojo). Borde punteado si la ubicación es aproximada. Popup con subpuntos, guardias y «Asignar guardias a este punto». Casilla en la leyenda para mostrarlos u ocultarlos.
- Menú «Rutas» → «Puntos Fijos»: lista con ocupación, alta y edición sobre el mapa, subpuntos, desactivar y reactivar. Política trasladar/retirar dentro del formulario y confirmación con la lista de guardias.
- Asistente: «Punto de Servicio Fijo» → lista de puntos de la EPI con ocupación (los llenos, deshabilitados) → guardias (cupo = libres) → confirmación con subpunto por guardia (automático o elegido).
- Panel lateral: las asignaciones a punto fijo se marcan «Punto fijo» y cuentan «en su punto».

### Pendiente / notas
- Confirmar la EPI de Cristo Seguro (Norte por el monumento o Central por las gradas) y de Pasaje Portales.
- Coordenadas aproximadas, sobre todo Inicio de gradas y Pasaje Portales: validarlas en campo y desmarcar «aproximada».
- Relevo de turno (14:00–14:30): la capacidad es estricta, así que los de la tarde no entran hasta que los de la mañana cierren turno o se les retire. Se revisa con la programación en F5.
- Revisión previa de F3: el aviso sobre `ventanasAutorizadas` quedó resuelto
  en la revisión de entrega. Las patrullas cerradas sin fecha de cierre no
  autorizan recorridos; las ventanas respetan inicio, fin y cierre de la
  ejecución. El aviso original mencionaba además usuarios sin detalles
  suficientes para identificar aquellos hallazgos.

### Correcciones de F4 pedidas por el usuario (16/10/2026)
| Pedido | Qué se hizo |
|---|---|
| Tiempo hasta que cambia de «incorporándose» | ETA por guardia (`lib/eta.ts` + `useTrayectosIncorporacion`): camino más rápido por calles (OSRM; la moto usa calles de autos) × factor de tráfico por franja horaria de Cochabamba (pico L–V 7–9, 12–14:30, 17:30–19:30; sáb 11:30–13:30) + arranque. Dos valores: probable y pesimista («tráfico atrancado»). A pie: distancia por calles a 4,5 km/h. Punto fijo/oficina: a pie hasta 1,5 km, si no en vehículo. Recalcula al moverse 80 m o cada 2 min; «detenido» si no avanza 25 m en 3 min; «retrasado» si pasa la hora pesimista inicial; aviso si el GPS tiene más de 5 min. Se ve en el detalle, el panel de alertas y la lista. Factores = propuesta inicial, ajustable. |
| Segmentación en puntos fijos | `GET /api/puntos-fijos` segmentado como las rutas (Operador/Admin: su EPI; Super Admin: todos; `?epi=` solo reduce). Evento `punto_fijo:actualizado` territorial (EPI del punto + supervisión; también la EPI anterior si cambió). Prueba F4 actualizada. |
| Línea punteada al asignar a un grupo | Eliminado `UnitPerimeterLines`. En su lugar, el camino más rápido de cada guardia hasta su punto (`TrayectosLayer`, línea del color de la ruta con borde blanco). Vista previa del asistente: mismo estilo, sin línea recta provisoria. |
| Clustering, zoom y jerarquía | `lib/capas.ts`: panes con orden fijo (territorios < trayectos < rutas < checkpoints < módulos < sedes < puntos fijos < guardias < SOS/seleccionado) y umbrales de zoom (puntos 11, contador 13, módulos 13, trayectos 13, checkpoints 15, subpuntos 16). Clustering solo de guardias; SOS y seleccionado nunca agrupados; radio según zoom; ícono por tamaño y con el borde del peor estado; `chunkedLoading`. Se quitó el punto duplicado en la posición GPS de cada guardia. |
| Centrar por rol | Operador: su EPI; Admin y Super Admin: el mapa completo. |
| Leyenda | `MapLegend`: desplegable (recuerda abierta/cerrada), con EPIs, símbolos y «qué queda encima». |
| Interruptores | `MapLayerToggles`: barra encima del mapa (territorios, sedes, rutas, incorporación, puntos fijos, módulos) con conteos, mini interruptor animado, `role="switch"`, preferencia por navegador. |
| Botones +/− | Quitados (`zoomControl={false}`); se acerca con rueda, doble clic, pinza o teclado. |
| Extra encontrados al probar | Alto del mapa medido (el aviso de SOS lo empujaba fuera de la pantalla); `invalidateSize` al cambiar el contenedor; panel de alertas oculto mientras se ven resultados del buscador; detalle del guardia en punto fijo («Punto fijo asignado», sin «calles por donde pasará»); distancia por calles cuando el servidor aún no midió. |


Notas: los servidores públicos (teselas OSM, Nominatim, OSRM) a veces fallan o limitan (una tesela gris, el buscador sin resultados); para producción conviene un proveedor propio. En desarrollo, un Fast Refresh puede dejar el mapa en blanco hasta recargar (no pasa con recarga completa).

**Segunda ronda (16/10, pedido del usuario):**
- Zoom de símbolos fijos para no encimarse con los guardias: sedes ocultas en la vista de ciudad, chicas desde 13 y completas desde 15; puntos fijos chicos desde 13 y completos con contador desde 15; módulos desde 15. Los guardias se ven en todos los niveles.
- Interruptores: sin el ícono gris de la izquierda; el interruptor se rehízo con flex (riel 28×16 con margen, perilla 12 px que se desliza 12 px), así la perilla no puede salirse.
- Doble clic en cualquier símbolo (punto fijo, subpunto, sede, módulo, checkpoint, punto asignado): zoom máximo (18) centrado en él. Su ventanita se abre sin desplazar el mapa (si no, el segundo clic caía en otro lado) y el doble clic la cierra. Clic en el pin de un guardia: zoom máximo al primer clic, además de abrir su detalle (desde la lista lateral se mantiene el acercamiento anterior).

**Tercera ronda (16/10, pedido del usuario):**
- Leyenda: sin la sección «Qué queda encima» y sin textos entre paréntesis (incluye «(tu EPI)» y «(referencia)»).
- Mapa: se quitaron los círculos numerados 1–5 repartidos sobre el trazado. Quedan los rombos = punto donde se incorpora cada guardia (leyenda y ventanita lo dicen así).
- Camino más rápido: ahora va al INICIO de la ruta (primer punto/calle del trazado), en el mapa en vivo y en la vista previa del asistente; en punto fijo, a su (sub)punto. La vista previa usa el mismo perfil que el mapa (la moto por calles de autos).
- «Calles por donde pasará»: caché del resultado ya en texto (memoria + navegador, hasta 200 rutas), con clave por coordenadas — antes se volvía a consultar al reabrir el detalle y en cada ping de GPS. Rótulos «Inicio de la ruta / Pasa por / Fin de la ruta». Nominatim no respondía desde esta red (ni con curl): se agregó Photon como respaldo (CORS abierto) y tiempos límite.
- Pendiente de decidir: el rombo (punto asignado por el motor, F2) puede no coincidir con el inicio de la ruta, adonde ahora apunta el trayecto.

**Cuarta ronda (16/10, pedido del usuario):**
- Rombos = las 4 calles de «Zona y calles por donde pasará» (mismos puntos; antes había un rombo por guardia en su punto asignado y en coche/moto se encimaban en 1). Puntos repartidos por distancia; si la ruta cierra el circuito: inicio, 1/4, 1/2, 3/4 (4 lugares distintos). Tooltip con la calle y «Inicio / Pasa por / Fin» (la calle se busca al abrirlo y queda en caché). Sin unir calles repetidas, para que cada rombo tenga su fila. Caché `gamc_calles_ruta_v2`.
- Incorporación: siempre línea roja discontinua (`ESTILO_INCORPORACION`), en el mapa y en la vista previa del asistente. Leyenda: ruta y rombos en azul para no confundirse con el rojo.
- Animación por nivel de zoom (globals.css): los símbolos que aparecen al cruzar su umbral o cambian de tamaño entran con fundido + crecimiento (280 ms); trayectos y módulos, con fundido. Íconos reutilizados (`iconoCacheado`) para que el refresco de datos no repita la animación. Respeta «reducir movimiento».


## F5 — Programación manual de rutas (16/10/2026)


### Decisiones (propuestas de Claude aceptadas por el usuario: «sí, empieza con 15 min antes»)
| # | Tema | Decisión |
|---|---|---|
| 1 | Cuándo se abre la tarea | **15 min antes** del inicio; los guardias asignados antes quedan «asignados» y empiezan su servicio a la hora de inicio. |
| 2 | Qué se programa | Rutas guardadas, predeterminadas y puntos fijos (el punto completo; el subpunto se elige al asignar). Las dinámicas no. |
| 3 | Horarios perdidos con el servidor caído | Solo se recupera el que sigue en curso; los terminados quedan anotados en el registro del planificador, sin crear ejecuciones. |
| 4 | Editar | Vale para horarios futuros. Cambiar días/hora/duración crea un horario nuevo (identidad nueva) y retira el anterior; cambiar solo el cupo mantiene la identidad. Lo ya abierto conserva su copia. |
| 5 | Rol de servicio real | No se carga solo: las programaciones se crean a mano (la API acepta `origen: prueba`). |

Decisiones de implementación:
- **Relevo en puntos fijos** (pendiente de F4): un horario programado tiene su PROPIO cupo (no compite con el turno que sale). Cuando empieza con guardias **releva** a la asignación abierta del punto (turno anterior o manual): esos guardias quedan libres y siguen en su turno. Con turnos solapados (06:30–14:30 y 14:00–22:00) el relevo ocurre a la hora de inicio del entrante. Si el entrante no tiene guardias, el saliente sigue hasta su fin.
- Una asignación manual a un punto con un horario programado en curso sin atender se suma a ese horario.
- Retirar al último guardia de un horario (o su fin de turno) **no** lo cierra: vuelve a «pendiente/incompleto» hasta su hora de fin.
- Cierre: «cubierta», «cubierta_parcial» o «sin_cubrir» según cuántos guardias llegaron a estar en servicio (nunca «completada» sin nadie). Cancelar = «cancelada_por_usuario» y no se reabre.
- Autoría: la ejecución la abre el sistema (`creado_por_tipo = sistema`) a nombre de quien programó (persona real); auditoría `abrir_horario` / `iniciar_horario` con actor sistema.

### Base de datos — migración `0010_programacion_rutas` (solo aditiva, con reversión)
- Tablas `ruta_programacion` (objetivo ruta XOR punto, EPI, vigencia en fechas locales, zona horaria, modo manual/automática para F6, estado activa/pausada/archivada, versión) y `ruta_programacion_ventana` (días ISO 1–7, hora, duración 15–1440 min, cupo; se desactiva, no se borra).
- `ruta_ejecucion`: `programacion_id`, `ventana_id`, `fecha_local`, `programacion_version`, `apertura` + **índice único (ventana, día local)**: un horario no se abre dos veces (ni con dos servidores) y dos horarios del mismo día son distintos.
- `planificador_estado` (fila única: interruptor, última pasada, último error) y `planificador_registro` (una fila por pasada con cambios o errores).
- Permiso `programacion_rutas`: Super Admin y Operador administran; Admin solo ve.
- Servidor de la U: `prisma/migrations/0010_programacion_rutas/migration.sql` (después de 0009) y su reversión `scripts/sql/revert/0010_programacion_rutas.revert.sql`.

### Backend
- Módulo `programacion`: `GET/POST /api/programaciones`, `PATCH /:id` (nombre, vigencia, pausar/reanudar, horarios), `PATCH /:id/archivar`, `GET /agenda?desde&hasta` (hasta 14 días; incluye horarios aún no abiertos y «no abiertos»), `GET /pendientes` (avisos «falta asignar», leídos de la BD), `GET/PATCH /planificador` (interruptor solo Super Admin; registro detallado solo supervisión). Evento `programacion:actualizada` territorial.
- Planificador (`planificador.ts`), cada minuto y al arrancar: 1) cierra lo vencido, 2) abre los horarios que empiezan en 15 min (horarios calculados en SQL con la zona horaria; un turno nocturno pertenece al día de inicio), 3) inicia los que llegaron a su hora. Reemplaza el intervalo de vencimiento de F2 (lo incluye); `DESACTIVAR_VENCIMIENTO_RUTAS=1` sigue apagándolo por instancia.
- Motor (F2/F4): `POST /mapas/ejecuciones` con el `ejecucionId` de un horario asigna a ESA ejecución; antes del inicio crea patrullas `asignada`; estado del horario = cobertura; cupo propio del horario (también por subpunto); relevo del punto al activarse.
- Pin del punto fijo: cuenta a quien está HOY (los asignados a un horario que aún no empieza no suman).

### Web
- Menú «Rutas» → **Rutas Programadas** (3 roles; el Admin solo mira): **Agenda** (Ayer/Hoy/Mañana, estado por color, guardias, **Asignar guardias** y cancelar horario) y **Programaciones** (días y horas, próximo horario, editar, pausar/reanudar, archivar; editor con chips L–D, atajos L–V/Todos, desde/hasta con «termina al día siguiente» / «24 horas», cupo máximo de la ruta o punto, vigencia). Estado del planificador y Pausar/Reanudar (Super Admin).
- Asistente en modo «horario programado»: Guardias → Confirmar, cupo = lo que falta, subpunto por guardia, «empiezan su servicio a las HH:MM», «Volver a la agenda».
- Campana: «Ruta programada «X» HH:MM: faltan N guardias» (desde la BD, aunque el socket esté caído); clic → `/mapas?programada=<id>` abre la agenda con el horario resaltado.
- Mini-mapa del asistente: se vuelve a medir al terminar la animación del modal.

### Ajustes tras la revisión del usuario (17/10/2026)
Decisiones del usuario: 1) pausadas al final de la lista; 2) eliminar cancela el horario abierto (recomendación aceptada); 3) campana solo mientras falten guardias; 4) bloquear horarios cruzados y quitar duración/capacidad también de «Rutas Guardadas».

| Pedido | Hecho |
|---|---|
| «Rutas Predeterminadas» → **Crear Ruta**; «Rutas Programadas» → **Programar Rutas** | Menú, títulos y textos |
| Quitar duración y cantidad de guardias de las rutas | Crear Ruta y Rutas Guardadas sin esos campos. Backend: la ruta no guarda duración ni capacidad (al editar una vieja se limpian); asignada al momento **no tiene hora de fin** (termina al cancelarla o cuando sus guardias cierran turno) y el cupo es el **máximo de la modalidad**. La API ignora esos campos si un cliente viejo los manda. Sin cambios en la BD. |
| Nombre por defecto «Coche / Vehículo · 22:09» | Vacío, con ejemplo gris; sigue siendo obligatorio |
| Campana sin aviso / ruta sin aparecer en el mapa | Diagnóstico con la BD: «Cristo Seguro» es un **punto fijo** (no dibuja línea; el contador «Rutas» solo cuenta líneas desde F4), el aviso vivió 53 s (creada 2 min antes y llenada enseguida) y los guardias tenían GPS del 08/10. Corregido el retraso real: los avisos de la campana se leen sin caché. |
| Sin fechas de vigencia | Editor sin «Vigente desde / Hasta». Funciona desde que se guarda hasta pausar o eliminar; el planificador cuenta los horarios que terminan después de crearse cada horario (el que está en curso al crearlo, también). Columnas `vigencia_*` se conservan (informativas). |
| Editar / Pausar / Eliminar | ⏸/▶ un solo botón; **Eliminar** (lógico, `estado = archivada`): sale de la lista y la agenda, cancela el horario abierto (`programacion_eliminada`) y libera a sus guardias; el historial queda. `DELETE /api/programaciones/:id` reemplaza a `PATCH /:id/archivar`. Pausadas al final. |
| Horarios cruzados (riesgo detectado: dos «Cristo Seguro» activas que se pisaban) | Se rechazan horarios que se cruzan dentro de la misma programación o con otra activa/pausada del mismo punto o ruta (incluye el domingo nocturno que sigue el lunes); seguidos sí. Bloqueo de la fila del punto/ruta para que dos operadores no guarden a la vez. |
| Robustez del planificador | Abrir un horario espera a una edición/pausa/eliminación en curso (`FOR SHARE`) y omite un horario retirado (`horario_retirado`). |


Datos locales a revisar: las dos programaciones «Cristo Seguro» creadas antes del bloqueo siguen cruzándose (el bloqueo aplica al guardar); conviene eliminar una. La que tenía «hasta 17/10» ya no se detiene sola.

#### Segunda revisión (17/10/2026)
| Pedido | Hecho |
|---|---|
| Agenda: lo de ayer solo visual → mejor solo Hoy y Mañana | Pestañas Hoy / Mañana. De ayer solo aparece, dentro de Hoy, el turno de noche que sigue abierto («empezó ayer»); lo de ayer cerrado o cancelado no se muestra. Lo que ya terminó no tiene botones. Si la agenda queda abierta pasada la medianoche, salta sola a Hoy. |
| (detectado) «Próximo: Ayer 22:15» en la lista | El «próximo» salta los horarios ya cerrados o cancelados y, si está en curso, dice «En curso hasta las HH:MM». |


## F6 — Asignación automática (17/10/2026)


### Decisiones (propuestas de Claude; supuestos de prueba ajustables en `programacion/config.ts`)
| Tema | Decisión |
|---|---|
| Modo | Cada programación es **manual** (como F5) o **automática**. El modo, el radio y la prioridad se copian en el horario al abrirlo: cambiarlos vale para los horarios siguientes. |
| Cuándo asigna | Al abrirse el horario (15 min antes), en la misma pasada. Si faltan, reintenta cada **2 min** hasta el fin del horario. Con el planificador pausado no intenta. |
| Candidatos | Cuenta activa, turno abierto y "en servicio", sin SOS, **sin otra ruta** (no retira a nadie), GPS de **menos de 10 min**, precisión ≤ 100 m (si se informa), batería **conocida y ≥ 15 %**, dentro del **radio** (obligatorio, 100–20 000 m). Una captura con hora "del futuro" (> 2 min) se ignora. No se modela aptitud de conducción. |
| Orden | Distancia a la ruta (al trazado) o al punto fijo; empate: id (estable). Entre horarios que compiten: **prioridad** (alta/normal/baja), luego el que empieza antes. |
| Punto de incorporación | Coche/moto: uno común (vértice más cercano al centro del grupo); a pie: el vértice más cercano a cada uno; punto fijo: lo reparte el motor por subpunto. |
| Retiro manual | Si un operador retira a un guardia o lo pasa a otra ruta, la automática **se detiene en ese horario** (no repone ni lo vuelve a traer); se completa a mano. Quien sale por **fin de turno** sí se repone. |
| Seguridad concurrente | Cada intento se **reclama** con la fila bloqueada (`FOR UPDATE SKIP LOCKED`) y su próximo intento; asigna con el **mismo motor** (bloquea guardias y horario, cupo, índice único de asignación activa) y **revalida** GPS, batería, radio, turno y SOS dentro de la escritura. |
| Explicación | Cada horario guarda el resumen del último intento (asignados, faltan, aptos, descartes por motivo) y el historial de intentos con elegidos (distancia) y descartados (motivo). Los reintentos sin novedad no llenan el historial. |
| Autoría | El sistema asigna en nombre de quien programó (auditoría `asignar_automatica`, actor `sistema`). |

### Base de datos — migración `0011_asignacion_automatica` (solo aditiva, con reversión)
- `ruta_programacion`: `radio_max_m` (100–20 000, obligatorio si automática), `prioridad` (1–5, por defecto 3).
- `ruta_ejecucion`: `asignacion_modo`, `auto_radio_m`, `auto_prioridad`, `auto_proximo_intento`, `auto_intentos`, `auto_ultimo` + índice parcial.
- Tabla nueva `asignacion_automatica_intento` (historial explicable).
- Reversión `scripts/sql/revert/0011_asignacion_automatica.revert.sql`: se detiene si hay programaciones automáticas u horarios automáticos abiertos. Ensayada en una copia (`gamc_migr_f6`): aplicar → revertir → reaplicar OK, y el bloqueo funciona. La migración es idempotente.

### Backend
- `programacion/automatica.ts` (nuevo): candidatos, orden, reclamo, intento, historial, revalidación en la escritura.
- Motor (`ejecuciones.service.ts`): opción `automatica` (no retira a nadie: motivo `ocupado`; requisitos revalidados con los guardias bloqueados; auditoría del sistema).
- Planificador: copia modo/radio/prioridad al abrir; paso automático; resumen con `intentosAuto`/`asignadosAuto`.
- Programación: `modo`, `radioMaxM`, `prioridad` al crear/editar; agenda y avisos con el estado de la automática; `GET /api/programaciones/horarios/:id/automatica` (detalle por EPI).

### Web
- Editor: «Asignación» manual/automática, radio máximo y prioridad, con la explicación de las reglas.
- Lista: «Asignación automática · radio 1 km · prioridad normal».
- Agenda: insignia AUTO, línea «Automática · HH:MM: asignó N · faltan M, reintenta HH:MM · descartados: …», aviso de «Automática detenida» y «Ver por qué» (elegidos con distancia, descartados con motivo).
- Campana: «Ruta automática «X» HH:MM: faltan N sin candidatos; reintenta HH:MM» o «se detuvo por un retiro manual, asigna a mano».

### Pendiente / notas
- Los guardias de la base local tienen GPS del 08/10: para ver la automática asignar hace falta GPS reciente (app móvil o simulación).
- Para confirmar con la institución antes del uso real: umbrales de GPS, precisión, batería y radio; si se debe reponer tras un retiro manual; aptitud de conducción para coche/moto; equidad (repartir carga entre guardias).

### Ajustes de F6 tras la revisión del usuario (17/10/2026)
| Pedido | Hecho |
|---|---|
| Interruptor para el modo automático, sin paréntesis | Editor: interruptor «Asignación automática» (con prioridad al encenderlo); sin el selector «Manual (…)/Automática (…)». |
| Radio automático: 3 km, +2 km cada 3 min sin nadie | El usuario ya no elige radio. Cada horario empieza en 3 km; si en 3 min (desde que se fijó el radio o desde la última asignación) no consigue a nadie, crece 2 km; tope 20 km. Reintento cada minuto. Se guarda el radio de cada intento (`asignacion_automatica_intento.radio_m`, añadido a la 0011, que aún no se publicó). |
| Agenda: tocar cualquier parte de la tarjeta para ver su información | Agenda: la tarjeta entera se despliega (ruta/punto, horario y apertura, guardias y su estado, modo y radio, último intento con elegidos y descartados) con sus acciones (Pasar a manual / Volver a automática / Cancelar horario). Programaciones: tocar la tarjeta abre su ficha (qué cubre, EPI, estado, modo, máximo, autor, horarios, próximos horarios que llevan a la agenda, Editar/Pausar/Eliminar). |
| Aviso cuando faltan guardias, al momento y sin refrescar | Revisado y probado: la tarjeta y la campana («Ruta automática «X» HH:MM: faltan N guardias; buscando en R km») se actualizan solas. Los intentos sin asignación avisan a agenda y campana (no al mapa) cuando hay algo nuevo: primer intento, radio ampliado o error. Lo que falta se cuenta con los guardias actuales (no con el último intento). |
| Retirar guardias de una ruta automática: Cancelar / Manual / Continuar | Ventana con tres botones. **Continuar**: busca al momento al reemplazo más cercano (sin esperar al planificador); el retirado no vuelve a ese horario. **Manual**: el horario pasa a manual (aparece «Asignar guardias»; se puede volver a automático desde la tarjeta). Reasignar a un guardia a otra ruta = Continuar. Fin de turno: repone solo. |
| ✕ sobre toda la ruta programada | Ventana de advertencia «es una ruta programada… ¿Estás seguro?» con sus guardias; hay que confirmar. |
| Automática sin «Asignar guardias» | En horarios automáticos no se ofrece; la campana avisa igual. |

Backend: retiro con `reposicion` (`PATCH /api/mapas/patrullas/:id/cancelar`), `PATCH /api/programaciones/horarios/:id/modo`, intento inmediato, el mapa recibe `programacionId` y `asignacionModo` de cada ruta. Web: `useDialog().elegir()` (tercer botón reutilizable).


#### Tercera revisión de F6 (17/10/2026)
| Pedido | Hecho |
|---|---|
| Quitar la prioridad | Fuera del editor, la ficha, la agenda y la API. Si dos horarios automáticos compiten por los mismos guardias, va primero **el que empieza antes** (luego id). Como la 0011 no se publicó, se quitó también de la migración, la reversión y el esquema; en las bases locales (desarrollo y pruebas) se quitaron a mano las columnas `prioridad`/`auto_prioridad`. |
| «Manual» es momentáneo: abre el selector de guardias y luego sigue automático | Al retirar con «Manual» el horario **sigue automático**: la automática espera hasta 5 min a que el operador elija (reserva, `auto_ultimo.reservaHasta`) y el mapa abre el asistente «Asignar guardias al horario» de ESE horario (botón «Cancelar» en vez de «Volver a la agenda»). Al cerrar el asistente (haya asignado o no) la automática sigue al momento con lo que falte (`POST /api/programaciones/horarios/:id/reanudar`). Si nadie hace nada, a los 5 min sigue sola. Se quitó «Pasar a manual / Volver a automática» de la agenda; la agenda muestra «un operador está eligiendo el reemplazo; si no, sigue sola a las HH:MM». |
| (detectado) Al abrir la agenda tras un rato se veía la foto vieja («revisó hace 4 min») | Agenda, programaciones y planificador se leen siempre frescos (sin caché). |


#### Rutas de otras EPIs visibles un rato al cambiar de cuenta (17/10/2026)
Reporte del usuario: tras pasar de Super Admin a Operador, por un rato seguían las rutas de las otras EPIs y luego desaparecían.

Causa: no era el backend (la segmentación por EPI de F3 ya filtraba). Era la **memoria del navegador**: cerrar e iniciar sesión navegaban dentro de la misma página (sin recargar), así que seguían vivos el caché del mapa (5 min) y las páginas ya cargadas; el Operador veía los datos que había cargado el Super Admin hasta la siguiente recarga.

Arreglo (web):
- Cerrar sesión espera al servidor y recarga de verdad `/login`; iniciar sesión entra con carga real. No queda nada en memoria de la cuenta anterior (mapa, páginas, cachés de módulos).
- Si en OTRA pestaña entra un usuario distinto, esta se recarga sola (al volver a ella o en el chequeo de cada 15 s).
- Defensa extra: el caché del mapa queda marcado con su usuario y nunca se reutiliza con otro.


## F7 — Paleta del logo y ajustes (17/10/2026)

- Paleta tinta + dorado bronce (tokens.css / tailwind.config.js) en ~50 componentes; sin restos de la paleta Innova.
- Mapas: pestañas como tarjeta con el mismo margen que el Topbar (m-3 / lg:m-4); contenido p-3 / lg:p-4 → todo a plomo.
- Banner SOS global oculto en `/mapas` (ahí ya están las fichas rojas).
- Login: marca de agua con `watermark-in` (0 → 0,45 → 0,14) en vez de fade-in a 1 con salto a 0,14.
- **Plazo para incorporarse (opción A)** — migración `0012_plazo_incorporacion` (aditiva: `patrulla.incorporacion_limite` + índice parcial; revert en `scripts/sql/revert/`). Plazo = arranque + distancia recta × 1,35 / velocidad × factor pesimista de la franja (mínimo 5 min); punto fijo a pie hasta 1,5 km. Se fija al pasar a "en curso" desde la última posición; sin posición, lo fija el primer ping. Vencido sin llegar: ping o planificador (cada minuto) → advertencia/alerta por distancia; si luego llega, se incorpora (verde). Ficha del guardia muestra el plazo.
