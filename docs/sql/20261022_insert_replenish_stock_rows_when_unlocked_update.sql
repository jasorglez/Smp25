USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Completar existencias en movimientos editables'
      AND version = N'5.00.366'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.366', N'Almacenes / Entradas y Salidas', 'IMPROVEMENT',
        N'Completar existencias en movimientos editables',
        N'Al reabrir un movimiento editable, el detalle conserva sus partidas guardadas y agrega los materiales y marcas con existencia que aún no están en el documento, con cantidad cero. Si el movimiento está autorizado, no se agregan renglones de existencia.',
        N'Permite completar o corregir un movimiento sin volver a capturar partidas guardadas; los documentos autorizados conservan su detalle.',
        N'Reabre un movimiento editable y encuentra los saldos que aún puedes capturar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Completar existencias en movimientos editables'
  AND isActive = 1;
GO
