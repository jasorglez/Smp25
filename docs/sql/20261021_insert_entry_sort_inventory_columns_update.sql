USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Ordena movimientos por ID y oculta la OC en inventarios'
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
        NULL, NULL, N'5.00.346', N'Almacenes / Entradas y Salidas', 'IMPROVEMENT',
        N'Ordena movimientos por ID y oculta la OC en inventarios',
        N'Los grids de Entradas y Salidas ordenan por ID descendente, dejando arriba los registros con ID más alto, sin usar la fecha como criterio. En Entradas, la columna Orden de Compra se oculta para Inicio y Ajuste de inventario según valueaddition configurado en el catálogo de movimientos de cada empresa.',
        N'Facilita encontrar los movimientos agregados más recientemente y enfoca la captura de inventario en sus campos correspondientes.',
        N'Encuentra primero tus movimientos más nuevos por ID y captura inventarios sin columnas de OC innecesarias.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET module = N'Almacenes / Entradas y Salidas',
    title = N'Ordena movimientos por ID y oculta la OC en inventarios',
    description = N'Los grids de Entradas y Salidas ordenan por ID descendente, dejando arriba los registros con ID más alto, sin usar la fecha como criterio. En Entradas, la columna Orden de Compra se oculta para Inicio y Ajuste de inventario según valueaddition configurado en el catálogo de movimientos de cada empresa.',
    userBenefit = N'Facilita encontrar los movimientos agregados más recientemente y enfoca la captura de inventario en sus campos correspondientes.',
    promoText = N'Encuentra primero tus movimientos más nuevos por ID y captura inventarios sin columnas de OC innecesarias.'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module IN (N'Almacenes / Entradas', N'Almacenes / Entradas y Salidas')
  AND title IN (N'Prioriza Entradas recientes y oculta la OC en inventarios', N'Ordena movimientos por ID y oculta la OC en inventarios')
  AND version = N'5.00.346'
  AND isActive = 1;

;WITH duplicateUpdates AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY idRoot, idCompany, version, module, title ORDER BY id) AS rowNumber
    FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Ordena movimientos por ID y oculta la OC en inventarios'
      AND version = N'5.00.346'
      AND isActive = 1
)
UPDATE product_update
SET isActive = 0
FROM dbo.product_updates AS product_update
INNER JOIN duplicateUpdates AS duplicate_update ON duplicate_update.id = product_update.id
WHERE duplicate_update.rowNumber > 1;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Ordena movimientos por ID y oculta la OC en inventarios'
  AND isActive = 1;
GO
