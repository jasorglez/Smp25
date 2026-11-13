USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.475' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.475', N'Seguridad / Permisos', 'FIX',
        N'Los permisos más nuevos aparecen primero',
        N'Los grids de permisos principales, detalles y subdetalles se ordenan por ID descendente al abrirse. Las filas recién agregadas sin ID permanecen arriba mientras se capturan.',
        N'Facilita encontrar los permisos agregados más recientemente en cada nivel.',
        N'Encuentra primero los permisos más nuevos en cada nivel del catálogo.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.475' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.475' AND isActive = 1;
