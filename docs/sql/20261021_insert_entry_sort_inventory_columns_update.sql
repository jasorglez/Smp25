USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Prioriza Entradas recientes y oculta la OC en inventarios'
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
        NULL, NULL, N'5.00.346', N'Almacenes / Entradas', 'IMPROVEMENT',
        N'Prioriza Entradas recientes y oculta la OC en inventarios',
        N'El grid ordena por fecha descendente y prioriza los registros de mayor ID cuando coincide la fecha. La columna Orden de Compra se oculta para Inicio y Ajuste de inventario según valueaddition configurado en el catálogo de movimientos de cada empresa.',
        N'Facilita encontrar movimientos recientes y enfoca la captura de inventario en sus campos correspondientes.',
        N'Encuentra primero tus Entradas más recientes y captura inventarios sin columnas de OC innecesarias.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Prioriza Entradas recientes y oculta la OC en inventarios'
  AND isActive = 1;
GO
