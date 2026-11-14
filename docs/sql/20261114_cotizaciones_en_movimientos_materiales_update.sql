USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.533',
    module = N'Almacenes / Materiales; Proyectos / Precios Unitarios',
    changeType = N'FIX',
    title = N'Cotizaciones en movimientos y desglose inicial APU',
    description = N'El resumen de movimientos busca las cotizaciones dentro de cada requisición y suma sus partidas al material relacionado. Al abrir el catálogo APU se selecciona la primera fila y se carga su desglose, incluso si el grid termina de iniciar después de los datos.',
    userBenefit = N'Identifica materiales cotizados y permite ver el primer desglose sin tener que abrirlo manualmente.',
    promoText = N'Consulta los materiales incluidos en cotizaciones y abre Precios Unitarios directamente con el primer desglose visible.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
