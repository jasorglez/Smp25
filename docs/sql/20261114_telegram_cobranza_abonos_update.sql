USE administration;
GO

-- Actualiza el anuncio vigente de Cobranza / Telegram sin crear duplicados.
-- Mantener LOCAL hasta contar con evidencia de despliegue del código.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.517',
    module = N'Cobranza / Telegram y tickets',
    changeType = N'IMPROVEMENT',
    title = N'Registro de abonos y ticket PDF en Telegram',
    description = N'El cobrador puede registrar abonos desde Telegram y recibir el comprobante PDF guardado en Firebase con el logo de la empresa. Los comprobantes web y de Telegram muestran cuánto queda pendiente después del abono.',
    userBenefit = N'Permite cobrar en campo y entregar un ticket con el saldo actualizado, mientras la impresión física no está disponible.',
    promoText = N'Registra abonos desde Telegram y entrega comprobantes con el saldo pendiente actualizado.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
