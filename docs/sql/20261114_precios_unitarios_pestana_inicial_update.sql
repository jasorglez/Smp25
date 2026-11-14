USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.530',
    module = N'Proyectos / Precios Unitarios',
    changeType = N'IMPROVEMENT',
    title = N'Catálogo abre con el desglose del primer precio',
    description = N'Al abrir Precios Unitarios desde la ruta principal, se muestra automáticamente la primera pestaña del catálogo, se selecciona el primer precio unitario y se carga su desglose de componentes.',
    userBenefit = N'Permite entrar al catálogo y consultar de inmediato cómo se integra el primer precio sin buscarlo y abrirlo manualmente.',
    promoText = N'Abre el catálogo y consulta desde el inicio el desglose de tu primer precio unitario.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
