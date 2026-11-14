USE administration;
GO

-- Actualiza el anuncio vigente sin crear duplicados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.524',
    module = N'Cobranza / Corte de Caja',
    changeType = N'IMPROVEMENT',
    title = N'Fondo inicial incluido en el reporte de Cobranza',
    description = N'El reporte y PDF del corte incluyen el fondo inicial de los turnos de cobranza del período, con desglose por turno y total. El fondo se muestra separado de los abonos recibidos.',
    userBenefit = N'Permite cuadrar la caja considerando el efectivo con que se abrió cada turno.',
    promoText = N'Consulta en el corte de Cobranza cuánto efectivo se dejó al abrir la caja y cuánto se recibió en abonos.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
