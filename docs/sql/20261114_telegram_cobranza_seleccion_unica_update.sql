USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.518',
    module = N'Cobranza / Telegram',
    changeType = N'IMPROVEMENT',
    title = N'Selección automática de cliente único en Telegram',
    description = N'Cuando la búsqueda encuentra un solo cliente, Telegram lo abre automáticamente; si encuentra varios, conserva la selección por lista.',
    userBenefit = N'Reduce pasos al cobrador y mantiene la confirmación cuando hay más de un resultado posible.',
    promoText = N'Busca un cliente en Telegram y entra directo cuando solo hay una coincidencia.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
