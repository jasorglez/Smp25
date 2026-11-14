USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.526',
    module = N'Cobranza / Clientes',
    changeType = N'FIX',
    title = N'Catálogo postal disponible al editar clientes',
    description = N'Al seleccionar o editar un cliente existente se carga el catálogo de colonias, ciudad y estado correspondiente a su código postal, igual que al capturar un cliente nuevo.',
    userBenefit = N'Permite corregir o completar la dirección de clientes existentes sin volver a escribir el código postal.',
    promoText = N'Edita un cliente y selecciona su colonia con la misma ayuda automática del código postal.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
