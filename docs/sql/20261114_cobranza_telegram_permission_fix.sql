USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.516',
    changeType = N'IMPROVEMENT',
    title = N'Corrección del menú de Cobranza en Telegram',
    description = N'Se corrigió la consulta de permisos de empresa que impedía cargar los módulos del usuario. Telegram respeta la configuración por empresa, sus permisos heredados y los permisos antiguos por sucursal.',
    userBenefit = N'El cobrador puede ver Cobranza en Telegram cuando el módulo está habilitado para su empresa y usuario.',
    promoText = N'Consulta Cobranza desde Telegram con los permisos de tu empresa.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates WHERE id = 291 AND isActive = 1;
GO
