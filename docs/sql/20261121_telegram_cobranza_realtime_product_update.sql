USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.596'
      AND module = N'Cobranza / Telegram y Caja'
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
        NULL, NULL, N'5.00.596', N'Cobranza / Telegram y Caja', N'IMPROVEMENT',
        N'Aviso de cobro de Telegram en Caja',
        N'Cuando un cobrador registra un pago desde Telegram, los usuarios autenticados y autorizados en esa empresa reciben en Caja un aviso en tiempo real con cliente, monto y cobrador.',
        N'Permite enterarse de los pagos del equipo sin actualizar la pantalla manualmente.',
        N'Recibe en Caja un aviso al instante cada vez que un cobrador registra un pago desde Telegram.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.596'
  AND module = N'Cobranza / Telegram y Caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
