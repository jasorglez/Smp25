USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.605'
      AND module = N'Cobranza / Préstamos'
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
        NULL, NULL, N'5.00.605', N'Cobranza / Préstamos', N'FIX',
        N'Actualización del calendario sin duplicar cuotas',
        N'Al modificar fechas o condiciones del préstamo, el servicio actualiza las cuotas existentes y conserva la restricción única de número de cuota por préstamo.',
        N'Permite guardar los cambios de calendario sin errores por números de cuota duplicados.',
        N'Ajusta las fechas del préstamo y guarda el calendario sin duplicar sus cuotas.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.605'
  AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
