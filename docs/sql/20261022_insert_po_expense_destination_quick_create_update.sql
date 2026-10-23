USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Órdenes de compra'
      AND title = N'Crear gasto destino desde la OC'
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
        NULL, NULL, N'5.00.368', N'Almacenes / Órdenes de compra', 'FEATURE',
        N'Crear gasto destino desde la OC',
        N'Si la empresa no tiene un gasto destino disponible, desde el selector de la OC se puede crear uno indicando cuenta bancaria y tipo de gasto. El registro toma la fecha, proyecto/sucursal y referencia de la orden, queda habilitado para recibir partidas y se selecciona en la OC.',
        N'Permite continuar la captura de la orden sin salir del módulo para preparar previamente el gasto destino.',
        N'Crea y vincula el gasto destino desde tu orden de compra en unos pasos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Crear gasto destino desde la OC'
  AND isActive = 1;
GO
