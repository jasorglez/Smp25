USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.607'
      AND module = N'Cobranza / Clientes'
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
        NULL, NULL, N'5.00.607', N'Cobranza / Clientes', N'FEATURE',
        N'Aviso visible de cuotas vencidas en Clientes',
        N'La lista de Clientes muestra la cantidad de personas y cuotas vencidas, el saldo pendiente y un acceso directo al filtro de vencidos; se actualiza al guardar cambios del calendario.',
        N'Permite detectar pagos atrasados y consultar los clientes afectados desde la lista principal.',
        N'Identifica de inmediato a tus clientes con pagos vencidos y consulta su saldo pendiente.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PENDING', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.607'
  AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
