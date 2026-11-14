USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.538',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Más espacio al buscar partidas de cotización',
    description = N'Al agregar productos o servicios, el grid de partidas tiene más altura y el selector ofrece un área de búsqueda más amplia para escribir y revisar resultados.',
    userBenefit = N'Facilita encontrar la partida correcta al capturar una cotización.',
    promoText = N'Busca productos y servicios con más espacio al agregar partidas a tus cotizaciones.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
