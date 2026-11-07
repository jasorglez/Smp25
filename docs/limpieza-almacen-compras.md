# Limpieza de Almacén y Compras

La opción **Limpieza de Almacén y Compras** aparece en la barra de submenús de Almacén y Compras únicamente para `root@bi2.mx`. La ruta tiene una guarda propia con ese correo fijo y el servidor exige la misma identidad del token autenticado. No se agregan ni modifican permisos.

## Uso

1. Seleccionar la empresa en el menú lateral.
2. Abrir la limpieza en Almacén o Compras y consultar la vista previa.
3. Revisar el nombre y número de empresa y los conteos de cada grupo.
4. Marcar la confirmación y escribir `LIMPIAR <número de empresa>`.
5. Revisar la ventana final: muestra nombre y número de empresa, grupos de documentos con sus cantidades y el total. Elegir «Sí, borrar datos de la empresa…» o «Cancelar, conservar los datos».
6. Esperar el resultado. Consultar de nuevo los listados para ver los datos actualizados.

No se ejecuta la limpieza al abrir la opción ni al consultar los conteos. La confirmación vence en cinco minutos, solo sirve para su empresa y se rechaza si los conteos cambian. Cambiar de empresa descarta la vista previa del navegador.

## Alcance

Se desactivan (`active = 0`) materiales; proveedores de tipo `PROVIDERS`; requisiciones; órdenes de compra; cotizaciones `QUOTE` y `COTIZ` y otros documentos de compra; entradas, salidas y movimientos de traspaso; sus partidas; marcas, componentes y conversiones de materiales; datos y relaciones de proveedores y subfamilias por proveedor.

Se incluyen documentos abiertos, cerrados, autorizados y cancelados, y datos vinculados a sucursales, proyectos y almacenes inactivos de la empresa. Las cotizaciones antiguas con `id_root` vacío o cero se identifican por su proyecto o sucursal. Si una compra o movimiento apunta a otra empresa, o su pertenencia no se puede comprobar, se bloquea la limpieza para revisar esas referencias.

Se conservan los almacenes, configuración, catálogos, empresas, sucursales, contratos, proyectos, clientes, seguridad, usuarios y permisos. No se borran archivos adjuntos físicamente ni registros de otros módulos. Inventario, kardex y trazabilidad se obtienen de los movimientos; no se crea un borrado separado de sus vistas.

## Servidor

El controlador `SMP/Controllers/WarehouseCleanupController.cs` expone:

- `GET /api/warehouse-cleanup/{companyId}/preview`: consulta y genera una confirmación protegida por Data Protection.
- `POST /api/warehouse-cleanup/{companyId}/execute`: valida identidad, confirmación, vigencia, empresa y conteos, y desactiva los registros en una transacción serializable.

Usa la conexión existente `dbSMP` y acceso SQL entre las bases `smp` y `warehouses` del mismo servidor, comprobado para las consultas. El código no requiere cambios de configuración ni del servicio de Seguridad. Ambas bases deben estar disponibles con permisos de actualización. La tabla de auditoría `smp.dbo.WarehouseCleanupAudit` se crea dentro de la primera limpieza; si falta permiso para crearla, toda la operación se revierte. Conserva empresa, actor, fecha UTC, conteos y resumen de la limpieza. No registra tokens.

Los cambios en datos y el registro de auditoría se confirman juntos. Una falla anterior a la confirmación de la transacción revierte sus actualizaciones. Ante una interrupción de red, consultar nuevamente el estado antes de reintentar.

## Validación

- Compilación Angular de desarrollo aprobada con advertencias ya existentes.
- Controlador compilado para .NET 8.
- Pruebas de rechazo de otro usuario, empresa inválida, texto incorrecto, token falso, token de otra empresa y confirmación vencida.
- Pruebas SQL sobre tablas temporales: vista previa sin cambios; limpieza lógica; cotizaciones antiguas; aislamiento entre empresas; conservación de almacenes y clientes; reversión y rechazo de referencias cruzadas.
- Vista previa real de la empresa 10 aprobada: 15 grupos y confirmación ligada a la empresa.
- Revisión visual pendiente. No se ha ejecutado ninguna limpieza sobre datos reales.
