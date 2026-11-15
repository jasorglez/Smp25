USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.543',
    module = N'Ventas / Cotizaciones',
    changeType = N'FEATURE',
    title = N'Encabezado editable para cotizaciones',
    description = N'Desde el detalle se puede editar el destinatario, empresa, puesto, lugar, fecha del documento, número y asunto. El PDF se actualiza con esos valores y la fecha original de creación se conserva.',
    userBenefit = N'Permite adaptar el encabezado de cada propuesta a quien la recibirá, sin cambiar el cliente vinculado ni la fecha original de creación.',
    promoText = N'Personaliza el encabezado de cada cotización y genera un PDF con los datos correctos para tu destinatario.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
