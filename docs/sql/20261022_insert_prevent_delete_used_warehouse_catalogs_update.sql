USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos'
      AND title = N'Protección de catálogos en uso'
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
        NULL, NULL, N'5.00.371', N'Almacenes / Catálogos', 'FIX',
        N'Protección de catálogos en uso',
        N'Antes de borrar una Entrada o Salida, se revisan sus movimientos guardados en los almacenes de la empresa; antes de borrar una Marca, se revisa si está asignada a materiales. Si está en uso, el sistema explica la referencia y cancela el borrado. Si no se puede comprobar el uso por un error de consulta, también bloquea la operación.',
        N'Evita perder catálogos que todavía se necesitan para consultar movimientos o materiales.',
        N'Conserva tus catálogos de almacén mientras tengan movimientos o materiales relacionados.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Protección de catálogos en uso'
  AND isActive = 1;
GO
