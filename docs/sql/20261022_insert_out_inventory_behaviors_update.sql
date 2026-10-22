USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos y Salidas'
      AND title = N'Configura inicio y ajuste de inventario en Salidas'
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
        NULL, NULL, N'5.00.344', N'Almacenes / Catálogos y Salidas', 'FEATURE',
        N'Configura inicio y ajuste de inventario en Salidas',
        N'Los catálogos de Salidas permiten asignar los comportamientos Inicio de inventario y Ajuste de inventario. En el detalle, ambos usan la captura especializada disponible en Entradas: partidas iniciales en cero, indicador de existencia y búsqueda de materiales.',
        N'Permite configurar salidas con los mismos comportamientos de inventario que entradas.',
        N'Configura inicios y ajustes de inventario también al registrar Salidas.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Configura inicio y ajuste de inventario en Salidas'
  AND isActive = 1;
GO
