USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.537',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Formato de texto en descripciones de cotización',
    description = N'El editor de partidas permite cambiar el tamaño de letra y aplicar negrita, cursiva y subrayado. Los estilos se conservan en la cotización y en el PDF.',
    userBenefit = N'Ayuda a ordenar y destacar información dentro de las descripciones de cada partida.',
    promoText = N'Da formato a las descripciones de tus cotizaciones: ajusta el tamaño y resalta texto.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
