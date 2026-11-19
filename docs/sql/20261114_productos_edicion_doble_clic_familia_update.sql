USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.531',
    module = N'Ventas / Productos',
    changeType = N'FIX',
    title = N'Edición de productos y subfamilias',
    description = N'Se restauró la edición de celdas con doble clic y, al cambiar la familia, se limpia la subfamilia anterior para elegir una compatible.',
    userBenefit = N'Permite editar desde el grid y evita guardar una subfamilia que pertenece a otra familia.',
    promoText = N'Edita productos con doble clic y asigna presentaciones de la familia correcta.',
    validationStatus = N'PENDING',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
