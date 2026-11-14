USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.528',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Selector amplio para buscar partidas',
    description = N'Al agregar una partida, el selector muestra la clave junto con la descripción, permite escribir para buscar por cualquiera de los dos datos y ahora tiene un ancho amplio para leer y capturar cómodamente.',
    userBenefit = N'Reduce el tiempo para localizar la partida correcta dentro del catálogo de cotizaciones y evita trabajar en un campo estrecho.',
    promoText = N'Encuentra tus productos y servicios por clave o descripción en un selector amplio.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
