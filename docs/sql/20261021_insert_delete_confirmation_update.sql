USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas'
      AND title = N'Confirmación antes de eliminar documentos y partidas'
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
        NULL, NULL, N'5.00.352', N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas', 'FIX',
        N'Confirmación antes de eliminar documentos y partidas',
        N'Antes de eliminar un maestro o una partida de una requisición, orden de compra, entrada o salida, el sistema pide confirmar la acción. Se conservan las validaciones que impiden borrar documentos con partidas asociadas.',
        N'Evita eliminar documentos o partidas por un clic accidental.',
        N'Confirma cada eliminación de requisiciones, órdenes de compra, entradas y salidas antes de continuar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Confirmación antes de eliminar documentos y partidas'
  AND isActive = 1;
GO
