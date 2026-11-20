USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.586'
      AND module = N'Compras / Órdenes de compra'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.586', N'Compras / Órdenes de compra', N'FIX',
        N'Creación del gasto destino de la orden de compra',
        N'Al crear un gasto destino desde una orden de compra, se prepara el tipo contable GASTO DE LA OC si aún no existe. Si la empresa solo tiene una cuenta bancaria y un tipo disponibles, el gasto se crea y vincula directamente; con varias opciones se conservan los selectores.',
        N'Evita que la falta del tipo contable impida crear el gasto destino de una orden de compra.',
        N'Crea el gasto destino de tu orden de compra sin detenerte por falta del tipo contable.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.586'
  AND module = N'Compras / Órdenes de compra'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
