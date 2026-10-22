USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Restaurar filas maestras al cerrar el detalle'
      AND version = N'5.00.363'
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
        NULL, NULL, N'5.00.363', N'Almacenes / Entradas y Salidas', 'FIX',
        N'Restaurar filas maestras al cerrar el detalle',
        N'Al cerrar un detalle con la X, el grid colapsa la partida abierta y restaura la altura de todas las filas maestras.',
        N'Permite volver a consultar todos los maestros después de cerrar sus detalles.',
        N'Cierra el detalle y vuelve a ver todos tus movimientos en el grid.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Restaurar filas maestras al cerrar el detalle'
  AND isActive = 1;
GO
