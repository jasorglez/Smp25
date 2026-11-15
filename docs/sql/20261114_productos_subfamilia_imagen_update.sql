USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.539',
    module = N'Ventas / Productos',
    changeType = N'FIX',
    title = N'Selección de subfamilia y carga de imágenes',
    description = N'Al crear productos, la subfamilia puede elegirse con el mouse o escribiendo para buscar. La carga de imagen admite JPG, PNG y WEBP, usa un nombre seguro para Firebase y muestra errores específicos de formato, tamaño o carga.',
    userBenefit = N'Facilita completar la clasificación y agregar imágenes de referencia al producto.',
    promoText = N'Elige la subfamilia con un clic y agrega imágenes de referencia al producto.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
