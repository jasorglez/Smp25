USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Existencia visible y validación por marca en Salidas'
      AND version = N'5.00.365'
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
        NULL, NULL, N'5.00.365', N'Almacenes / Salidas', 'FIX',
        N'Existencia visible y validación por marca en Salidas',
        N'La columna del saldo disponible se identifica como Existencia y su encabezado queda visible. La validación de Consumo Normal usa la existencia por marca cargada en el grid, evitando rechazos por una consulta individual de stock que devuelve cero.',
        N'Permite revisar el saldo disponible y guardar cantidades que no superen la existencia del material y su marca.',
        N'Consulta la existencia por marca y guarda tus salidas con el saldo visible.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencia visible y validación por marca en Salidas'
  AND isActive = 1;
GO
