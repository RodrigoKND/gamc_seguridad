# Revisión de entrega F1–F7 — 17/10/2026

Resultado: no se encontraron conflictos de integración con los `main` remotos
consultados. Se corrigieron dos problemas del backend antes de dar por terminada
la revisión. Compilaciones, tipos y pruebas indicadas abajo pasan. Esto no
sustituye la comprobación del despliegue contra los datos y servicios reales.

## Comparación con GitHub

Se ejecutó `git fetch origin --prune` correctamente en ambos repositorios.

| Repositorio | `origin/main` | Rama revisada (`redesign/integracion`) | Resultado |
|---|---|---|---|
| Frontend | `662f12dcddf7417521e9d424c54bbf19abfcc6ff` | `f871e06f7907fdf14485dfbe831078744744c5ba` + cambios locales | main es antecesor; 0 commits exclusivos de main y 3 de integración |
| Backend | `1ebc17a033d7bf3cea106de23c245db5e74cd853` | `2bb56cc2c62d977c21382aefb2111921244707eb` + correcciones locales | main es antecesor; 0 commits exclusivos de main y 3 de integración |

No hay divergencia que produzca conflictos de fusión con esos commits.
Las migraciones anteriores a 0006 y los manifiestos de dependencias no cambian
respecto de main. Si main avanza después, corresponde repetir la comparación.

## Contraste de los documentos con la implementación

`01_Cambios_F1-F7.md` es un registro cronológico: las revisiones posteriores
reemplazan decisiones iniciales. `Entrega-F1-F7.md` resume el estado de entrega.

| Fase | Código y comportamiento contrastados | Resultado |
|---|---|---|
| F1 | Migración 0006, catálogo `epis`, geometría y jurisdicción, catálogo web | Implementados; pruebas de clasificación, EPIs inactivas y validación de usuarios pasan |
| F2 | Migración 0007, motor `ejecuciones`, SOS, asistente y agrupación por ejecución | Implementados; asignación parcial, idempotencia, concurrencia, cupos y fin de turno probados |
| F3 | Migración 0008, alcance de hechos/mandados/mapas, telemetría, salas por EPI y permisos | Implementados; corregido el acceso a recorridos históricos sin cierre fiable |
| F4 | Migración 0009, puntos/subpuntos, ocupación, editor y capas de mapa | Implementados; capacidad, concurrencia y políticas de edición probadas; coordenadas aproximadas siguen pendientes de validación en campo |
| F5 | Migración 0010, planificador, programaciones y agenda web | Implementados; apertura 15 minutos antes, turnos nocturnos, relevo y cancelación probados; agenda actual Hoy/Mañana |
| F6 | Migración 0011, automática, selección y reposición | Implementados; radio 3 km + 2 km cada 3 minutos sin asignar, tope 20 km, reintento cada minuto, sin prioridad; reserva manual hasta 5 minutos |
| F7 | Migración 0012, plazo de incorporación, tokens visuales y SOS | Implementados; vencimiento y llegada posterior probados; diseño revisado en código y compilación, sin validación visual interactiva en esta revisión |

## Correcciones realizadas

1. **Privacidad de recorridos (backend).** `ventanasAutorizadas` permitía que
   una patrulla cerrada sin `completada_en` autorizara GPS hasta el presente.
   Ahora omite esas filas sin cierre fiable y acota las ventanas al inicio,
   fin y cierre de su ejecución. Una reserva futura tampoco autoriza GPS
   previo a su horario. Se añadieron seis pruebas unitarias de regresión.
2. **Reversión parcial (backend).** El script conjunto confirmaba cada
   migración por separado: un bloqueo en 0011 podía dejar 0012 ya revertida.
   Ahora toda la entrega se revierte en una sola transacción. Los scripts
   individuales conservan su transacción al ejecutarlos por separado.
   La guía indica resolver bloqueos con la web actual, detener el backend,
   revertir y después publicar las versiones anteriores.
3. **Documentación y publicación.** Se corrigieron la agenda descrita, las
   referencias a la guía trasladada y el orden de instalación del backend.
   Se documentó renovar sesiones y reasignar cuentas de Centro Cercado.
   La exclusión local `.git/info/exclude` impedía subir ambos Markdown de
   `cambios/`; ahora permite los Markdown y sigue excluyendo las herramientas
   locales. El traslado desde `manual/Entrega-F1-F7.md` queda visible para Git.

## Verificación ejecutada

- Frontend: `npm run lint` sin errores (10 advertencias), `npm run typecheck`
  y `npm run build` satisfactorios. El primer build dentro del aislamiento
  falló al resolver páginas generadas; la repetición autorizada fuera del
  aislamiento completó todas las páginas y las trazas de producción.
- Backend: `npm test`: **70/70**; `npm run typecheck` y `npm run build`: OK.
- Integración: `npx vitest run -c vitest.integration.config.ts`: **133/133**,
  siete archivos F1–F7, PostgreSQL real. La preparación recreó exclusivamente
  `gamc_seguridad_test` y aplicó todas las migraciones mediante Prisma.
- SQL: base nueva `gamc_revision_20261017_test`; aplicación desde el esquema
  anterior, reaplicación idempotente, bloqueo deliberado de la reversión en
  0011 conservando 0012, reversión total, reaplicación y reversión individual:
  todos satisfactorios. Se conserva esa base desechable para inspección.
- `git diff --check`: sin errores en ambos repositorios.

Las pruebas de integración existentes están excluidas localmente de Git en el
backend; esta ejecución local no implica que GitHub las ejecute automáticamente.
La nueva prueba unitaria de recorridos sí queda disponible para versionar.

## Antes de desplegar

- Incluir las correcciones del backend y la documentación del frontend
  al publicar la entrega F1–F7.
- Respaldar producción; instalar dependencias, aplicar 0006–0012, desplegar
  backend y después frontend. No ejecutar el seed de demostración.
- Revisar los datos reales: 0007 aborta si un guardia tiene varias patrullas
  activas. No se consultó ni migró la base de producción.
- Renovar sesiones para recibir los permisos nuevos; reasignar las cuentas
  de Centro Cercado a una EPI operativa. Confirmar coordenadas y jurisdicción
  de Cristo Seguro/Pasaje Portales con la institución.
- Verificar salud, autenticación, segmentación, mapa, SOS, ejecución del
  planificador y una asignación con GPS reciente en el entorno publicado.
  No se comprobó disponibilidad/capacidad de los proveedores externos de mapas
  ni el comportamiento de la app móvil en un dispositivo real.

## Archivos de la revisión

`Revision-preproduccion.md` permanece en `cambios/`. Los auxiliares
`revision_backend.py`, `probar_reversion.py` y la copia `recorridos.test.ts`
se trasladaron a `.run/revision-preproduccion/`, excluida de Git. La prueba
unitaria del backend se conserva en `src/modules/turnos/__tests__/`.

Se incluyen también los manuales y referencias que estaban pendientes en
`manual/` y `design/`. Su inclusión no equivale a una actualización integral
de esos documentos a F1–F7: para esta entrega prevalecen las guías de entrega
y el contraste de fases de este informe.
