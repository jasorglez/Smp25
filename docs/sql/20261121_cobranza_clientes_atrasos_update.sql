USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.599'
      AND module = N'Cobranza / Clientes y Caja'
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
        NULL, NULL, N'5.00.599', N'Cobranza / Clientes y Caja', N'IMPROVEMENT',
        N'Consulta de cuotas vencidas y aviso de atraso en los cobros',
        N'El listado de clientes muestra el saldo vencido y las cuotas vencidas aún sin cubrir. El aviso en tiempo real de un cobro desde Telegram también indica el saldo vencido que queda y cuántas cuotas siguen atrasadas después del abono.',
        N'Permite detectar atrasos pendientes desde Caja y revisar la cartera vencida sin abrir cada préstamo.',
        N'Recibe el aviso del cobro y consulta cuántas cuotas vencidas conserva el cliente, con el saldo atrasado a la vista.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.599'
  AND module = N'Cobranza / Clientes y Caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
