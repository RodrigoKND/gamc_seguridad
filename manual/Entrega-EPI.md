# Entrega: jurisdicciones EPI e inicio de sesión

## Alcance y permisos comprobados

Crear, asignar y cancelar rutas exige el permiso del rol y, salvo super_admin,
una EPI asignada. La API comprueba la EPI de la ruta y de los guardias y los
puntos del trazado. Una cuenta sin EPI no puede gestionar rutas.
El superadministrador está exento de la restricción territorial.

Esto NO constituye aislamiento territorial de toda la aplicación:
guardias (biografía/estados), hechos (cambio de estado) y usuarios continúan
autorizándose por rol, sin una comprobación sistemática de EPI del registro.
No publicar esta entrega como control territorial completo de esos módulos.

Los cinco polígonos son aproximaciones: Sud agrupa Sur, Jaihuayco y Alalay Sud.
El inventario contiene ubicaciones de seis EPIs y módulos, no límites oficiales.
Centro Cercado es una zona del modelo actual, no una séptima EPI del inventario.

## Cambios coordinados

Frontend: login por usuario o correo, manejo de errores, cookies HttpOnly,
recuperación de perfil, corrección de caché de assets en desarrollo y capas
territoriales con leyenda/encuadre. `npm run dev` fija el puerto 3000.

Backend: relación user.epi_id, endpoint de jurisdicción, validación territorial
de rutas, asignación de EPI al crear usuarios y polígonos iniciales.

Publicar primero el backend y aplicar `npx prisma migrate deploy` contra la
base de destino antes de publicar el frontend. Las migraciones 0004/0005 son
necesarias; ejecutar `npx prisma generate` durante la instalación/build.
Configurar EPI para las cuentas existentes con un administrador autorizado:
las migraciones no asignan una EPI automáticamente a usuarios de producción.
No ejecutar el seed de demostración en producción.

Revisar individualmente las plantillas antiguas sin EPI. El script opcional
07_rutas_backfill_epi.sql elige la EPI mayoritaria de sus patrullas; requiere
revisión antes de usarlo, especialmente si existen patrullas de varias EPIs.
Los polígonos aproximados también requieren validación antes de uso operativo.

## Verificación realizada

- TypeScript correcto; lint sin errores (10 advertencias previas).
- Backend: 38 pruebas correctas, incluidas cuenta sin EPI, registro ajeno y excepción del superadministrador.
- Chromium: login de superadministrador y operador, dashboard según rol,
  guardias, reportes, cinco colores y teselas del mapa visibles.
- Recuperación del perfil con refresh HttpOnly comprobada.
- Creación de ruta fuera de la EPI del operador rechazada con HTTP 403.
- Compilación de producción correcta en frontend y backend. El frontend
  conserva 10 advertencias de lint y avisos de compatibilidad Edge en una
  dependencia de jose; no impiden compilar.

## Referencias GitHub revisadas

- Frontend: main b5934f0; redesign contiene el rediseño previo 89aefc5.
- Backend: main 19a0739; cambios publicados en redesign, commit 43a7ae7.
- Los cambios del frontend se entregan en redesign; no se fusionaron con main.

Los cambios ajenos (borrado de README, otros manuales e imagen de diseño)
quedan fuera de esta entrega. No incluir .env, logs, .run, node_modules ni .next.
