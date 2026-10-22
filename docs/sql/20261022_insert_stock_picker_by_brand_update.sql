USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Selector de materiales por marca y existencia'
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
        NULL, NULL, N'5.00.359', N'Almacenes / Entradas', 'IMPROVEMENT',
        N'Selector de materiales por marca y existencia',
        N'En Traspasos y Ajustes, el selector muestra una opción por material y marca con su existencia disponible. La columna Marca tiene más espacio y la búsqueda también encuentra marcas.',
        N'Permite elegir la marca correcta y revisar su saldo antes de capturar la partida.',
        N'Elige materiales por marca y consulta el saldo disponible de cada una.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Selector de materiales por marca y existencia'
  AND isActive = 1;
GO
