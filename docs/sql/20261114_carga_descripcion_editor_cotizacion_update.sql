USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.536',
    module = N'Ventas / Cotizaciones',
    changeType = N'FIX',
    title = N'Carga de descripción al editar partidas',
    description = N'Al abrir el editor de una partida, se carga de forma explícita la descripción actual, incluyendo el formato en negrita guardado.',
    userBenefit = N'Evita que el editor aparezca vacío y permite continuar modificando el texto de la cotización.',
    promoText = N'Abre la descripción de una partida y continúa editándola con su texto y formato actuales.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
