USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.587'
      AND module = N'Almacenes / Entradas'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.587', N'Almacenes / Entradas', N'IMPROVEMENT',
        N'Almacén de origen visible en el PDF de entradas',
        N'El PDF de cada movimiento de entrada muestra el nombre del almacén bajo el encabezado Almacén Origen, incluidos Recepción de compras y otros movimientos.',
        N'Permite identificar en el comprobante a qué almacén corresponde la recepción.',
        N'Consulta el almacén de origen directamente en el PDF de tus entradas.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.587'
  AND module = N'Almacenes / Entradas'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
