USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.520',
    module = N'Cobranza / Telegram',
    changeType = N'IMPROVEMENT',
    title = N'Selección automática de préstamo único en Telegram',
    description = N'Si el cliente tiene un solo préstamo con saldo pendiente, Telegram abre directamente sus próximas cuotas; si tiene varios, muestra la lista para elegir.',
    userBenefit = N'Reduce pasos al registrar el abono sin perder la elección cuando existe más de un préstamo.',
    promoText = N'Registra un abono más rápido: Telegram abre automáticamente el único préstamo pendiente.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
