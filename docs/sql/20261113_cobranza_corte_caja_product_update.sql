USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.491' AND module = N'Cobranza / Corte Caja'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.491', N'Cobranza / Corte Caja', N'IMPROVEMENT',
        N'Tipos de pago y corte de caja de cobranza',
        N'Los abonos registran su tipo de pago y responsable. Corte Caja consulta movimientos y totales por período, y permite guardar cortes globales o por cobrador.',
        N'Facilita revisar los cobros y conservar el detalle de cada corte.',
        N'Consulta los cobros por tipo de pago y prepara cortes de caja globales o por cobrador.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PENDING', N'LOCAL', N'DRAFT', NULL,
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.491' AND module = N'Cobranza / Corte Caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
