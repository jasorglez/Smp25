USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.513' AND module = N'Cobranza / Clientes'
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
        NULL, NULL, N'5.00.513', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Filtros de saldos pendientes y pagos vencidos',
        N'El listado de clientes permite mostrar todos, solo quienes tienen saldo pendiente o solo quienes tienen cuotas vencidas con importe sin cubrir. Los filtros se actualizan al registrar o quitar abonos y al cambiar fechas de pago.',
        N'Ayuda a localizar la cartera pendiente y los atrasos sin revisar cada cliente.',
        N'Encuentra rapidamente clientes con saldo pendiente y pagos vencidos.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.513' AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
