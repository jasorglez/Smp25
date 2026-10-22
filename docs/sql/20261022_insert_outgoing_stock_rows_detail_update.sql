USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Existencias disponibles directo en el detalle de Salidas'
      AND version = N'5.00.364'
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
        NULL, NULL, N'5.00.364', N'Almacenes / Salidas', 'IMPROVEMENT',
        N'Existencias disponibles directo en el detalle de Salidas',
        N'En el Consumo Normal, el grid de detalle carga una fila por material y marca con existencia positiva en el almacén. Las cantidades inician en cero y al guardar solo se envían las partidas con cantidad capturada. El selector ya no ofrece crear materiales nuevos.',
        N'Permite consultar las existencias disponibles en una sola vista y registrar solo los materiales que se retirarán.',
        N'Consulta los materiales disponibles por marca y captura solo las cantidades que vas a retirar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencias disponibles directo en el detalle de Salidas'
  AND isActive = 1;
GO
