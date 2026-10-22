USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas'
      AND title = N'Guarda el maestro o el detalle con F10'
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
        NULL, NULL, N'5.00.347', N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas', 'IMPROVEMENT',
        N'Guarda el maestro o el detalle con F10',
        N'F10 guarda el grid que tiene el foco: el grid maestro guarda los encabezados y el grid de detalle guarda las partidas. Antes de guardar, termina la edición activa en la celda.',
        N'Permite guardar con el teclado sin confundir los cambios del encabezado con los de sus partidas.',
        N'Presiona F10 para guardar el maestro o sus partidas, según el grid donde estés trabajando.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Guarda el maestro o el detalle con F10'
  AND isActive = 1;
GO
