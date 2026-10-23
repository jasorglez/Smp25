USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Kardex'
      AND title = N'Historial Kardex por material'
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
        NULL, NULL, N'5.00.373', N'Almacenes / Kardex', 'FEATURE',
        N'Historial Kardex por material',
        N'Se agregó la vista Kardex con historial cronológico de entradas, salidas, traspasos y ajustes, saldo acumulado por material, marca y almacén, y filtros de material, almacén y fechas. Desde el grid de Materiales se puede abrir el Kardex filtrado para ese producto.',
        N'Permite revisar el recorrido y el saldo de un material desde un solo lugar, o consultar movimientos de varios materiales con filtros.',
        N'Consulta el historial y saldo de tus materiales por almacén, marca y periodo.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Historial Kardex por material'
  AND isActive = 1;
GO
