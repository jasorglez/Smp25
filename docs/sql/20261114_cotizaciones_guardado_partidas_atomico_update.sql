USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.542',
    module = N'Ventas / Productos y Cotizaciones',
    changeType = N'FIX',
    title = N'Guardado seguro de productos y cotizaciones',
    description = N'Al editar un producto se envían solo los campos modificados, evitando que datos antiguos del registro provoquen el rechazo de una imagen nueva; los errores de validación del servidor se muestran con su campo. El guardado de partidas conserva lo que no esté cargado y elimina solo las partidas confirmadas.',
    userBenefit = N'Facilita guardar imágenes de productos y protege las partidas existentes de las cotizaciones.',
    promoText = N'Actualiza imágenes de productos y guarda cotizaciones con mayor seguridad, sin perder partidas que no aparecen en pantalla.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
