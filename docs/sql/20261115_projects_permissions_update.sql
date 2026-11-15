USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.545',
    module = N'Seguridad / Proyectos',
    changeType = N'FIX',
    title = N'Permisos de Proyectos consolidados',
    description = N'Se consolidaron los permisos duplicados de Contratos y Conceptos sin perder asignaciones existentes. Las rutas del módulo ahora validan el permiso detallado correspondiente; el menú de Órdenes oculta Búsquedas OT si falta su permiso. El enlace de Precios Unitarios se muestra con el permiso del catálogo.',
    userBenefit = N'Evita entradas repetidas en la asignación de permisos y bloquea el acceso por URL a secciones que el usuario no tiene habilitadas.',
    promoText = N'Asigna accesos de Proyectos sin duplicados y protege cada sección según su permiso.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
