USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos'
      AND title = N'Catálogo de Marcas en Almacenes'
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
        NULL, NULL, N'5.00.369', N'Almacenes / Catálogos', 'FEATURE',
        N'Catálogo de Marcas en Almacenes',
        N'Se agregó la pestaña Marcas junto a Entradas y Salidas. Permite consultar, agregar y editar las marcas de la empresa en el catálogo BRAND.',
        N'Centraliza el mantenimiento de las marcas desde el módulo de Almacenes.',
        N'Administra las marcas de tus materiales desde el catálogo de Almacenes.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Catálogo de Marcas en Almacenes'
  AND isActive = 1;
GO
