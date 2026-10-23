USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

UPDATE dbo.product_updates
SET isActive = 0
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.369'
  AND title = N'Catálogo de Marcas en Almacenes'
  AND isActive = 1;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos'
      AND title = N'Marcas junto a los catálogos de movimientos'
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
        NULL, NULL, N'5.00.370', N'Almacenes / Catálogos', 'FIX',
        N'Marcas junto a los catálogos de movimientos',
        N'En /warehousesTD/catalogs se agregó la pestaña Marcas entre Entradas y Salidas. Desde ahí se pueden consultar, agregar y editar las marcas de la empresa mediante el catálogo BRAND.',
        N'Permite administrar las marcas desde la misma pantalla de catálogos que ya se usa para configurar los movimientos del almacén.',
        N'Administra las marcas de tus materiales junto a los catálogos de Entradas y Salidas.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Marcas junto a los catálogos de movimientos'
  AND isActive = 1;
GO
