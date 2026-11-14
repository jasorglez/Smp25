USE administration;
GO

-- Actualiza el anuncio vigente sin crear duplicados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.525',
    module = N'Almacenes / Materiales',
    changeType = N'IMPROVEMENT',
    title = N'Búsqueda y filtros para materiales',
    description = N'El listado de materiales permite buscar por texto parcial en códigos, descripciones, familias y marcas. También puede filtrarse para mostrar materiales con requisiciones, órdenes de compra, entradas, salidas o cotizaciones, y materiales con existencia total positiva en la empresa.',
    userBenefit = N'Permite encontrar materiales con menos pasos y enfocar la consulta en artículos con actividad o existencia.',
    promoText = N'Encuentra materiales con “DES” y filtra en segundos los que tienen movimientos o existencia.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
