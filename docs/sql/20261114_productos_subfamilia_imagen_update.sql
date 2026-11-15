USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.540',
    module = N'Ventas / Productos',
    changeType = N'FIX',
    title = N'Edición de productos y selector de subfamilia',
    description = N'El selector de subfamilia permite elegir opciones con mouse y teclado, y la edición del producto envía únicamente los campos del material. Si el servidor rechaza el guardado, se muestra el detalle de validación disponible. La carga de imagen admite JPG, PNG y WEBP.',
    userBenefit = N'Permite clasificar y editar productos con más facilidad, e identifica el motivo del rechazo al guardar.',
    promoText = N'Edita productos, elige su subfamilia con mouse o teclado y consulta el motivo si un guardado requiere corrección.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
