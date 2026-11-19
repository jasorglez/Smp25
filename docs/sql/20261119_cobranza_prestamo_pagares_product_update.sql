USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
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
        NULL, NULL, N'5.00.556', N'Cobranza / Préstamos', N'IMPROVEMENT',
        N'Interés mensual y desglose del pagaré',
        N'Al registrar un préstamo se puede indicar un porcentaje de interés fijo mensual sobre el capital original. El calendario desglosa capital e interés por pago y el pagaré muestra el total, las mensualidades, los logos y espacios de firma en la vista previa habitual.',
        N'Permite explicar cada mensualidad y entregar al cliente el pagaré con el calendario de pagos.',
        N'Genera el pagaré de Cobranza con el desglose de capital e interés de cada mensualidad.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PENDING', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
