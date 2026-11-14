USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.522',
    module = N'Cobranza / Tickets',
    changeType = N'IMPROVEMENT',
    title = N'Ticket de abono en el visor PDF estándar',
    description = N'El ticket que se genera al registrar un abono en Clientes abre en el visor PDF estándar, con sus opciones para compartir, enviar o descargar, sin abrir otra pestaña.',
    userBenefit = N'Permite revisar y compartir el comprobante desde la misma pantalla de Cobranza.',
    promoText = N'Comparte o descarga el ticket de cada abono desde el visor PDF de Cobranza.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
