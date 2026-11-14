USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.535',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Formato de negrita en partidas de cotización',
    description = N'El editor de descripción de partidas incluye formato de negrita. El formato se conserva en la partida y se muestra también en el PDF.',
    userBenefit = N'Permite destacar datos importantes sin cambiar el texto base del producto del catálogo.',
    promoText = N'Resalta con negritas la información importante de cada partida y consérvala en el PDF.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
