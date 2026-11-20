USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.585'
      AND module = N'Cobranza / Corte de caja'
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
        NULL, NULL, N'5.00.585', N'Cobranza / Corte de caja', N'IMPROVEMENT',
        N'Resumen de caja y ahorro por cobrador',
        N'El corte de caja muestra por cobrador el fondo inicial, los abonos del período, el efectivo esperado y contado al cerrar, la diferencia y el saldo personal de ahorro. El saldo de ahorro se presenta por separado y no se suma al efectivo de caja. El PDF incluye el mismo resumen.',
        N'Permite revisar los cobros y el estado del corte de cada cobrador, además de consultar su ahorro sin mezclarlo con el efectivo de caja.',
        N'Consulta en el corte de cobranza el fondo inicial, los cobros y el ahorro de cada cobrador, también en PDF.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.585'
  AND module = N'Cobranza / Corte de caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
