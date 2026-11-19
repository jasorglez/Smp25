USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.534',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Editor amplio para descripciones de cotización',
    description = N'Al dar doble clic en la descripción de una partida se abre un editor amplio para modificar el texto guardado en esa cotización.',
    userBenefit = N'Facilita revisar y personalizar descripciones largas sin cambiar el producto del catálogo.',
    promoText = N'Personaliza la descripción de cada partida de cotización desde un editor amplio.',
    validationStatus = N'PENDING',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
