# Registro de actualizaciones

> Historial interno de cambios con texto sugerido para convertir las novedades en anuncios. La hora se registra en `America/Indiana/Indianapolis`. Los anuncios permanecen como borrador hasta que se publiquen en el módulo Publicidad.

## Historial

| Fecha y hora | Versión / referencia | Módulo | Tipo | Qué cambió | Beneficio para el usuario | Texto sugerido para Publicidad | Validación / despliegue | Publicación |
|---|---|---|---|---|---|---|---|---|
| 2026-10-15 17:39 EDT | `31cbde95` | Cotizaciones | Mejora | Se habilitó capturar importes manuales en USD y seleccionar varias familias de materiales para una cotización. | Permite cotizar con más flexibilidad cuando el material o el precio se maneja en dólares. | **Cotizaciones más flexibles:** captura importes en dólares y combina familias de materiales. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-15 18:43 EDT | `5db8a2f7` | Cotizaciones PDF | Mejora | Se ajustó el envío de cotizaciones PDF por correo para evitar el límite de tamaño de Firestore y se mejoró el cierre con firma. | Facilita compartir cotizaciones completas por correo. | **Comparte cotizaciones PDF por correo** con su cierre y firma. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-15 22:03 EDT | `43af89be` | Cotizaciones | Nueva función | Se agregó una ventana dedicada para editar los materiales de una cotización. | Organiza la captura sin perder el contexto de la cotización. | **Nuevo editor de materiales** para trabajar tus cotizaciones con mayor claridad. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-16 15:30 EDT | `cbda5260` · `77625523` | Precios unitarios | Nueva función | Se integró la importación del Anexo H, reportes de precio seleccionado y explosión completa, con avance de generación. | Agiliza la carga y revisión de análisis de precios unitarios y sus desgloses. | **Precios unitarios:** importa el Anexo H y genera reportes con avance visible. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-16 16:02 EDT | `a6f2c93c` | Proyectos y Administración | Mejora | Se amplió el espacio vertical de los grids de saldos y catálogos auxiliares. | Permite consultar más información en pantalla. | **Grids con más espacio** para consultar tus datos cómodamente. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-16 16:14 EDT | `f9081c12` | Sucursales | Mejora | El sistema inicia con la primera sucursal asignada y avisa cuando se seleccionan todas las sucursales. | Evita abrir consultas con un contexto ambiguo. | **Elige la sucursal correcta** y consulta tus datos con mayor claridad. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-16 18:33 EDT | `2633de7b` · `1ddd0aa8` · `ee345996` | Saldos | Corrección | Se alineó el saldo del grid y del PDF con el saldo de apertura y las reglas para bajas lógicas. | Muestra un cierre coherente con los movimientos válidos y el saldo inicial. | **Saldos más claros:** el grid y el reporte reflejan el mismo cierre. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-16 20:01 EDT | `b0b6cd16` · `56b92087` | Egresos PDF | Mejora | El PDF se muestra dentro del visor y la ventana conserva las fechas seleccionadas; también se mejoró la presentación de errores. | Revisa el reporte y regresa a los filtros sin capturarlos de nuevo. | **Revisa el reporte de egresos** y conserva los filtros que seleccionaste. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-16 20:33 EDT | `d8a4ec1d` | Inicio | Nueva función | El inicio muestra el nombre completo del usuario y avisos de días festivos próximos según el país. | Personaliza la bienvenida y ayuda a anticipar días festivos. | **Una bienvenida personal** y avisos oportunos de los próximos días festivos. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-16 21:11 EDT | `0ffccc74` · `bdea3ab7` | Publicidad | Mejora | Se colocaron las novedades en la parte superior del inicio, junto al saludo y el contexto. | Facilita encontrar anuncios, actualizaciones y tutoriales desde el inicio. | **Consulta novedades, anuncios y tutoriales** en la parte superior del inicio. | Commit en `main`; despliegue sin confirmar. | Borrador |
| 2026-10-16 22:19 EDT | 5.00.205 · `ad13fed5` | Reportes PDF | Mejora | Se unificaron los visores de reportes y se agregaron controles de zoom, descarga y opciones para compartir por correo, WhatsApp y Telegram. | Consulta y comparte reportes desde el mismo visor. | **Visores PDF renovados:** ajusta el zoom y comparte tus reportes desde el mismo lugar. | Compilación de producción aprobada; commit en `main`. | Borrador |
| 2026-10-16 22:49 EDT | 5.00.206 · local | Reportes PDF | Corrección | El envío por correo sube el PDF a Storage y lo agrega a la cola como adjunto por URL; valida destinatarios y muestra el estado o error de Firebase. Se redujo la espera de confirmación. | Facilita enviar reportes grandes y reduce la espera visible. | **Envío de reportes más confiable:** comparte PDFs grandes por correo y recibe una respuesta clara. | TypeScript validado; pendiente de commit y despliegue. | Borrador |

## Contexto recomendado para cada novedad

Para que una actualización se entienda y pueda promocionarse, registra:

- **Problema o necesidad:** qué estaba intentando hacer la persona.
- **Cambio realizado:** qué puede hacer ahora y en qué módulo.
- **Beneficio concreto:** tiempo ahorrado, errores evitados o información más clara.
- **Alcance:** perfiles o módulos que reciben la mejora; evita nombres de clientes.
- **Evidencia:** validación ejecutada, versión/commit y si está local, en pruebas o desplegada.
- **Material para el anuncio:** captura o video/tutorial relacionado cuando exista.

## Ideas para el espacio de Publicidad

- **Novedad reciente:** una mejora por tarjeta, con fecha, beneficio y enlace a una explicación.
- **Tip rápido:** una función existente que ayude a completar una tarea en menos pasos.
- **Mejoras por módulo:** agrupar las novedades de Proyectos, Administración, Ventas y Almacén.
- **Actualización de versión:** resumen corto de varias mejoras de una misma entrega, al estilo del historial de Winamp.
- **Tutorial relacionado:** enlazar la novedad a un video de YouTube cuando exista; mantener separados los anuncios internos de los promocionales.
