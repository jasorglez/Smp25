USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.515',
    changeType = N'IMPROVEMENT',
    title = N'Permisos de Cobranza alineados con el sistema web en Telegram',
    description = N'Telegram consulta los permisos por empresa igual que el sistema web, incluidos los permisos globales heredados y los permisos antiguos por sucursal.',
    userBenefit = N'El cobrador puede usar Cobranza en Telegram con los permisos ya configurados para su empresa.',
    promoText = N'Usa Cobranza en Telegram con los permisos que ya tienes configurados en el sistema.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates WHERE id = 291 AND isActive = 1;
GO
