USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.610'
      AND module = N'Cobranza / Calendario de pagos'
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
        NULL, NULL, N'5.00.610', N'Cobranza / Calendario de pagos', N'FIX',
        N'Edición estable de fechas programadas',
        N'Las fechas de las cuotas se editan con un clic. El selector no cierra la edición al elegir la fecha y la sincronización automática se pausa durante la captura.',
        N'Permite cambiar y guardar las fechas del calendario sin perder la edición.',
        N'Actualiza las fechas de pago del préstamo desde el calendario, sin perder la edición.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.610'
  AND module = N'Cobranza / Calendario de pagos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
