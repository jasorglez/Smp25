USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.601'
      AND module = N'Cobranza / Calendario de préstamos'
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
        NULL, NULL, N'5.00.601', N'Cobranza / Calendario de préstamos', N'IMPROVEMENT',
        N'Edición de fechas del calendario de cuotas',
        N'Cada préstamo cuenta con una opción para habilitar la edición de fechas programadas. Los cambios se pueden guardar o deshacer sin modificar los montos ni los abonos registrados.',
        N'Facilita ajustar los vencimientos del préstamo y conservar el historial de pagos.',
        N'Ajusta las fechas de pago de cada préstamo y conserva su historial de abonos.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.601'
  AND module = N'Cobranza / Calendario de préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
