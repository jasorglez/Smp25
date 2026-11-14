USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.529',
    module = N'Proyectos / Precios Unitarios',
    changeType = N'IMPROVEMENT',
    title = N'Precios Unitarios abre en el catálogo',
    description = N'Al abrir Precios Unitarios desde la ruta principal, se muestra automáticamente la primera pestaña del catálogo.',
    userBenefit = N'Permite entrar directamente al catálogo sin seleccionar la pestaña manualmente.',
    promoText = N'Abre Precios Unitarios y consulta el catálogo desde el primer momento.',
    validationStatus = N'PENDING',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
