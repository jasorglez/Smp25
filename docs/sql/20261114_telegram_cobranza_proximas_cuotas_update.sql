USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.519',
    module = N'Cobranza / Telegram',
    changeType = N'IMPROVEMENT',
    title = N'Próximas cuotas pendientes en Telegram',
    description = N'Al registrar un abono, la lista muestra solo las 3 cuotas pendientes con fecha más cercana.',
    userBenefit = N'Facilita elegir rápidamente la cuota correcta sin recorrer toda la tabla de pagos.',
    promoText = N'Consulta y selecciona las próximas cuotas pendientes desde Telegram.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
