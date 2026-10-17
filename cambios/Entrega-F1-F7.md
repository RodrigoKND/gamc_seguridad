# Entrega F1–F7: EPIs, patrullaje, puntos fijos, programación y diseño

Frontend. Requiere el backend de la misma entrega (`docs/entrega-f1-f7.md`
en el repositorio del backend), con las migraciones 0006–0012 aplicadas.

## Qué incluye

- **F1 — Catálogo de EPIs.** La web identifica cada EPI por el código del
  backend (`/api/epis`). El mapa muestra los territorios con el color del
  catálogo, las sedes numeradas 1–6, la capa opcional de módulos policiales
  y la zona de referencia del Centro. Los selectores ofrecen solo las EPIs
  operativas.
- **F2 — Rutas y asignación.** Menú «Rutas» (Crear Ruta, Asignar Ruta, Rutas
  Guardadas). El asistente asigna en parte: informa qué guardias no se pudieron
  asignar y por qué, y pide confirmar las reasignaciones. Añade una ventana de
  diálogo reutilizable (`useDialog`). El panel muestra los estados de ruta que
  calcula el servidor y permite atender los SOS por alerta.
- **F3 — Segmentación por EPI.** La EPI actual de cada guardia sale de su GPS;
  los guardias son libres entre EPIs; cada operador ve y edita según su
  alcance; la exportación incluye todos los registros.
- **F4 — Puntos fijos.** Pines con ocupación (n/cap), alta y edición de puntos
  y subpuntos, asignación a un punto. Mapa con capas por zoom, agrupación de
  guardias, interruptores de capas y leyenda desplegable. Camino y tiempo
  estimado de incorporación.
- **F5 — Programar Rutas.** Agenda (hoy y mañana; incluye el turno nocturno
  iniciado ayer que sigue abierto) y programaciones por
  días y horas. La campana avisa cuando a un horario le faltan guardias.
- **F6 — Asignación automática.** Interruptor en la programación, detalle de
  cada intento en la agenda y retiro con reposición (Cancelar / Manual /
  Continuar). Al cambiar de cuenta no quedan datos de la anterior.
- **F7 — Diseño y ajustes.** Paleta institucional del logo (tinta y dorado
  bronce) en toda la web. Mapa alineado con la barra superior. Banner SOS fijo
  al desplazarse y oculto en el mapa. El aviso SOS acerca el mapa al guardia.
  Logo en el inicio de sesión. La ficha del guardia muestra su plazo para
  incorporarse.

## Despliegue

1. Desplegar primero el backend y su base de datos.
2. Sin variables de entorno nuevas: las mismas de `.env.local`. `JWT_SECRET`
   debe coincidir con el del backend.
3. `npm ci`, `npm run build` y `npm start` (o el proceso de publicación
   habitual).
4. Verificar: inicio de sesión; el Módulo de Mapas carga guardias, rutas y
   puntos fijos; el menú «Rutas» abre «Programar Rutas»; un SOS activo muestra
   el banner fuera del mapa y su enlace acerca el mapa al guardia.
5. Volver a iniciar sesión en las cuentas existentes para recibir los nuevos
   permisos. Reasignar desde Super Admin las cuentas de Centro Cercado a una
   EPI operativa: esa EPI histórica queda inactiva y rechaza acceso territorial.
