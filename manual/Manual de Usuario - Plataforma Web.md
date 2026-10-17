# Manual de Usuario — Plataforma Web de Seguridad Ciudadana

**Gobierno Autónomo Municipal de Cochabamba**<br>
**Dirección de Seguridad Ciudadana**

| Datos del documento | Información |
| --- | --- |
| Sistema | Plataforma de Seguridad Ciudadana — Primera etapa |
| Documento | Manual de Usuario de la Plataforma Web |
| Versión del manual | 1.0 |
| Fecha | Septiembre de 2026 |
| Dirigido a | Operadores de monitoreo, administradores y superadministradores |
| Responsable del documento | [Completar antes de publicar] |
| Canal de soporte | [Completar teléfono, correo y horario] |

> **Antes de publicar:** reemplace los datos entre corchetes y confirme que las pantallas de Mapas y Reportes muestran información oficial. La documentación técnica disponible indica que estas pantallas pueden usar información de prueba mientras termina su conexión con el sistema central.

## 1. Acerca de este manual

Este manual explica las tareas cotidianas de la plataforma web: revisar la situación del día, ubicar guardias, atender alertas, asignar rutas, consultar reportes y administrar al personal autorizado.

Está organizado por tareas. Puede ir directamente a la sección que necesita sin leer todo el documento.

La aplicación móvil tiene su propio manual. Consulte **Manual de Usuario — Aplicación Móvil para Guardias Municipales** si realiza trabajo de campo.

En este manual, **EPI** significa Estación Policial Integral y **hecho** significa un incidente o novedad registrada por un guardia.

## 2. Quién puede hacer cada tarea

La plataforma muestra solamente las opciones habilitadas para su cuenta. Por este motivo, su menú puede ser diferente al de otra persona.

| Tarea | Operador de monitoreo | Administrador | Superadministrador |
| --- | :---: | :---: | :---: |
| Ver el mapa y la ubicación de los guardias | Sí | Sí | Sí |
| Atender una alerta SOS desde el mapa | Sí | Consulta | Sí |
| Asignar, modificar o cancelar rutas | Sí | Consulta | Sí |
| Consultar la lista de guardias | Sí | Sí | Sí |
| Editar datos y estado de un guardia | Consulta | Sí | Sí |
| Consultar reportes de hechos | Sí | Sí | Sí |
| Cambiar el estado de un hecho | Sí | Consulta | Consulta |
| Consultar y exportar el historial | Sí | Sí | Sí |
| Ver el resumen general | No | Sí | Sí |
| Crear cuentas y credenciales | No | No | Sí |

**Consulta** significa que puede ver la información, pero no cambiarla.

> Los permisos de esta tabla reflejan el comportamiento actual de la plataforma web. Si necesita una tarea que no aparece en su cuenta, solicite la revisión de su perfil al responsable autorizado.

## 3. Antes de ingresar

Necesita:

- Una cuenta asignada por el GAMC.
- La dirección oficial de la plataforma: **[Completar dirección web]**.
- Un navegador actualizado y conexión a internet estable.

No comparta su contraseña. La plataforma registra las acciones realizadas con cada cuenta.

## 4. Ingresar y salir

### Ingresar

1. Abra la dirección oficial de la plataforma (https://gamc-seguridad-ciudadana.vercel.app).
2. En **Usuario o correo institucional**, escriba su correo.
3. En **Contraseña**, escriba su clave.
4. Si necesita comprobar lo escrito, seleccione el símbolo de ojo.
5. Seleccione **Ingresar**.
6. Espere el mensaje de acceso correcto.

El operador de monitoreo ingresa directamente al **Módulo de Mapas**. El administrador y el superadministrador ingresan al **Dashboard**.

Si olvidó la contraseña, contacte a Sistemas GAMC mediante el canal institucional indicado al inicio de este manual.

### Salir

1. Seleccione su nombre en la esquina superior derecha.
2. Seleccione **Cerrar sesión**.
3. Cierre el navegador si utiliza un equipo compartido.

## 5. Reconocer la pantalla principal

La plataforma tiene cuatro áreas de uso frecuente:

| Área | Para qué sirve |
| --- | --- |
| Menú principal | Abre las secciones disponibles para su cuenta. |
| Barra superior | Muestra la sección actual, las alertas y los datos de su cuenta. |
| Aviso de emergencia | Aparece cuando existe una alerta SOS activa. |
| Área de trabajo | Muestra mapas, listas, formularios y detalles. |

En una pantalla pequeña, seleccione **Abrir menú** para ver las secciones. En una computadora puede usar **Colapsar menú** para ampliar el área de trabajo.

### Revisar notificaciones

1. Seleccione la campana de la barra superior.
2. Revise las alertas recientes.
3. Seleccione una notificación para ir al guardia o al reporte relacionado.
4. Use **Marcar leídas** cuando haya revisado todas.

Marcar una notificación como leída solo ordena la bandeja. No resuelve el hecho ni la emergencia.

## 6. Revisar el resumen general

Esta sección está disponible para administradores y superadministradores.

El **Dashboard** muestra:

- hechos registrados hoy;
- hechos en revisión;
- alertas SOS pendientes;
- guardias en servicio;
- hechos de los últimos siete días;
- distribución por tipo de hecho;
- distribución por zona EPI.

Para ver el detalle, seleccione una tarjeta, un punto del gráfico o una barra. Cierre el panel de detalle para volver al resumen.

Use esta pantalla para conocer la situación general. Para cambiar el estado de un hecho, vaya a **Reporte** con una cuenta de operador. Para gestionar una alerta SOS o una ruta, vaya a **Módulo de Mapas** con una cuenta habilitada.

## 7. Usar el Módulo de Mapas

### 7.1 Ver el patrullaje en vivo

1. En el menú, seleccione **Módulo de Mapas**.
2. Abra **Mapa de Patrullaje en Vivo**.
3. Use el buscador si necesita ubicar una calle, plaza o zona.
4. Seleccione un guardia en el mapa o en la lista lateral.
5. Revise su estado, ubicación, batería, última actualización, turno y ruta asignada.

Si la última actualización supera cinco minutos, compruebe la comunicación con el guardia. Un tiempo mayor puede indicar que el teléfono está apagado, sin señal o con la ubicación desactivada. La posición mostrada es la última recibida; no asuma que sigue siendo la posición actual.

### 7.2 Interpretar el estado de un guardia

| Estado | Significado |
| --- | --- |
| Fuera de servicio | No tiene un turno activo. |
| En servicio | Tiene un turno activo y puede ser asignado a una ruta. |
| Emergencia | Tiene una alerta SOS activa y requiere atención inmediata. |

Cuando un guardia tiene una ruta, el panel indica si permanece en ella o si se ha desviado. Use este dato junto con la hora de la última ubicación.

### 7.3 Revisar zonas de riesgo

1. Seleccione **Mapa de Calor / Zonas de Riesgo**.
2. Revise la concentración de hechos en el mapa.
3. Seleccione una zona para centrarla y ver su nivel de riesgo.

Los niveles disponibles son **Muy alto**, **Alto**, **Medio** y **Bajo**. No dependa solamente del color; lea siempre el nombre del nivel.

La pestaña **Futuras vistas GIS** está reservada para ampliaciones y no contiene una tarea operativa en esta versión.

## 8. Atender una alerta SOS

Esta tarea está disponible para operadores de monitoreo y superadministradores.

1. Al aparecer el aviso de emergencia, seleccione la alerta.
2. La plataforma abrirá el mapa y enfocará al guardia relacionado.
3. Verifique el nombre, la ubicación y la hora de la última actualización.
4. Aplique el protocolo institucional de emergencia y mantenga comunicación por el medio establecido.
5. No cierre la alerta mientras la emergencia siga activa o no exista confirmación del personal responsable.
6. Cuando la atención haya concluido, abra el detalle del guardia.
7. Seleccione **Marcar como resuelto (volver a servicio normal)**.
8. Compruebe que el guardia dejó de aparecer en estado **Emergencia**.

> La plataforma ayuda a ubicar y registrar la alerta. No reemplaza el protocolo institucional ni los canales de auxilio establecidos.

Si la alerta no desaparece, no la marque repetidamente. Actualice la pantalla una vez y, si continúa, contacte al soporte indicando el nombre del guardia y la hora de atención.

## 9. Asignar una ruta de patrullaje

Esta tarea está disponible para operadores de monitoreo y superadministradores. Solo pueden seleccionarse guardias que estén **En servicio**.

1. En **Mapa de Patrullaje en Vivo**, seleccione **Asignar Ruta**. También puede abrir un guardia y elegir **Asignar Ruta a este Guardia**.
2. Elija **Nueva Asignación** o **Usar Plantilla Guardada**.
3. Si crea una ruta, elija la modalidad: vehículo, motocicleta, a pie, punto fijo u oficina.
4. Seleccione uno o varios guardias. La pantalla muestra el máximo permitido para la modalidad elegida.
5. En el mapa, marque los puntos en el orden del recorrido. Debe marcar entre dos y cinco puntos.
6. Revise el camino calculado. Use **Deshacer** o **Reiniciar** si necesita corregirlo.
7. Seleccione **Siguiente**.
8. Compruebe los guardias, la modalidad y el trazado.
9. Escriba un nombre claro para la ruta y, si corresponde, una descripción.
10. Si desea reutilizarla, marque **Guardar como plantilla reutilizable**.
11. Seleccione **Asignar Ruta**.
12. Espere el mensaje **Ruta asignada correctamente**.

Si la plataforma informa que no pudo calcular el camino por calles, revise la aproximación mostrada antes de confirmar. No asigne un recorrido inseguro o imposible de realizar.

### Cancelar una asignación

En la lista lateral del mapa puede:

- retirar a un guardia de una ruta; o
- cancelar la ruta completa.

Lea el mensaje de confirmación antes de continuar. Cancelar la ruta completa afecta a todos los guardias asignados a ella.

## 10. Consultar y administrar guardias

1. En el menú, seleccione **Guardias**.
2. Busque por nombre o EPI.
3. Si lo necesita, filtre por estado de servicio o por zona.
4. Revise la tabla de resultados.
5. Seleccione **Ver Catálogo** para consultar el directorio completo, incluidos registros inactivos.

La lista principal muestra el personal operativo. El catálogo conserva también el historial de guardias dados de baja.

### Editar un guardia

Esta tarea está disponible para administradores y superadministradores.

1. Localice al guardia.
2. Seleccione **Editar**.
3. Corrija los datos necesarios.
4. Para una baja administrativa, seleccione **Desactivar**. Para devolver el acceso, seleccione **Activar**.
5. Si modificó datos personales o la EPI, seleccione **Guardar Cambios**.
6. Compruebe que la información se actualizó.

No confunda los dos tipos de estado:

- **Estado de cuenta** indica si la persona puede acceder al sistema.
- **Estado operativo** indica si está fuera de servicio, en servicio o en emergencia.

### Exportar la lista

1. Aplique los filtros que necesite.
2. Abra **Exportar**.
3. Elija Excel o PDF.

La exportación incluye todos los resultados que coinciden con los filtros, aunque la pantalla muestre solo una página.

## 11. Revisar reportes de hechos

1. En el menú, seleccione **Reporte**.
2. Busque por la información disponible en el reporte.
3. Filtre por estado o por nivel de riesgo.
4. Seleccione una fila para abrir el detalle.
5. Revise la descripción, el guardia que informó, la fecha, la ubicación y las fotografías o videos disponibles.

Los estados de un hecho son:

| Estado | Uso esperado |
| --- | --- |
| Abierto | El reporte fue recibido y aún no comenzó su atención. |
| En proceso | El reporte está siendo revisado o atendido. |
| Resuelto | La atención concluyó y el reporte puede considerarse cerrado. |

### Cambiar el estado de un hecho

Esta tarea está disponible para el operador de monitoreo.

1. Abra el detalle del hecho.
2. En **Estado del hecho**, seleccione el nuevo estado.
3. Compruebe que el cambio aparece en la lista.

Cambie el estado solamente cuando corresponda con la atención real. No use **Resuelto** si todavía existen acciones pendientes.

## 12. Consultar y exportar el historial

1. En **Reporte**, seleccione **Historial**.
2. Indique las fechas **Desde** y **Hasta** si necesita un periodo específico.
3. Elija una EPI y un tipo de hecho, o conserve las opciones generales.
4. Revise la cantidad de resultados y avance con **Anterior** o **Siguiente**.
5. Abra **Exportar**.
6. Elija Excel para trabajar con los datos o PDF para obtener un documento listo para compartir o imprimir.

La exportación respeta los filtros aplicados. Antes de distribuir un archivo, compruebe el periodo y la EPI indicados.

## 13. Crear cuentas y credenciales

Esta tarea es exclusiva del superadministrador.

### Crear una cuenta

1. En el menú, seleccione **Generar Credenciales**.
2. Elija **Operador de Monitoreo**, **Guardia** o **Administrador**.
3. Complete los datos solicitados.
4. Seleccione **Generar Credenciales**.
5. Espere la confirmación.
6. Seleccione **Copiar credenciales** y entréguelas a la persona mediante el canal institucional autorizado.
7. Indique a la persona que deberá cambiar la contraseña temporal en su primer ingreso.

Para un guardia se solicitan nombres, apellidos, cédula de identidad, fecha de nacimiento, teléfono y EPI asignada. Para operadores y administradores también se solicita el correo institucional.

La contraseña temporal se muestra al terminar el registro. Guárdela antes de cerrar la ventana y no la envíe por canales públicos.

### Evitar registros duplicados

Antes de crear una cuenta:

- busque al guardia en el catálogo;
- confirme la cédula de identidad;
- confirme el correo institucional del personal web.

Si la plataforma informa que la cédula o el correo ya existen, no cree una segunda cuenta. Revise el registro existente.

## 14. Solución de problemas

| Situación | Qué hacer |
| --- | --- |
| No puede ingresar | Revise el correo y la contraseña. Si persiste, contacte a Sistemas GAMC. |
| Una opción no aparece | Puede que su perfil no tenga permiso. Consulte la tabla de la sección 2. |
| La pantalla no carga | Revise la conexión, seleccione **Reintentar** si aparece y vuelva a ingresar si la sesión terminó. |
| La ubicación no cambia | Revise la hora de la última actualización y contacte al guardia. No interprete una ubicación antigua como actual. |
| No hay guardias para asignar | Confirme que tengan un turno activo y estado **En servicio**. |
| No puede cambiar un reporte | Solo el operador de monitoreo puede cambiar el estado desde la plataforma actual. |
| La exportación sale vacía | Revise las fechas y filtros. Amplíe el periodo si es necesario. |
| Una alerta atendida continúa visible | Actualice una vez. Si continúa, informe el nombre del guardia y la hora al soporte. |

Al pedir ayuda, indique:

- su nombre y perfil;
- la sección donde ocurrió el problema;
- la fecha y hora;
- el mensaje mostrado;
- el código o nombre del guardia o reporte relacionado.

No envíe contraseñas por correo, mensajería o capturas de pantalla.

## 15. Cuidado de la información

- Use la plataforma solo para tareas institucionales.
- No comparta datos personales, ubicaciones o evidencias con personas no autorizadas.
- Compruebe los destinatarios antes de enviar una exportación.
- Cierre la sesión al terminar, especialmente en equipos compartidos.
- Informe de inmediato cualquier acceso que no reconozca.

## 16. Lista de capturas recomendadas antes de publicar

El manual puede utilizarse sin imágenes. Para una edición de capacitación, se recomienda agregar capturas con datos de demostración y sin información personal real:

1. Inicio de sesión.
2. Menú principal y campana de alertas.
3. Dashboard con sus cuatro indicadores.
4. Mapa de patrullaje y detalle de un guardia.
5. Aviso SOS y botón para marcarlo como resuelto.
6. Los cuatro pasos de asignación de una ruta.
7. Lista y catálogo de guardias.
8. Detalle de un reporte.
9. Filtros del historial y menú de exportación.
10. Confirmación de credenciales generadas, usando datos ficticios.
