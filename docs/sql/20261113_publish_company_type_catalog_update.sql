USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.472' AND isActive = 1
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
        NULL, NULL, N'5.00.472', N'SMP / Empresas', 'FEATURE',
        N'Tipos de empresa administrados desde el catálogo',
        N'El selector Tipo de empresa de /smp/root carga sus opciones del catálogo compartido de SMP. Incluye Construcción, Clínica, Escuelas, Restaurantes y Comercializadora. Las opciones futuras se administran como datos del catálogo y ya no están fijas en la pantalla.',
        N'Permite agregar tipos de empresa al catálogo sin cambiar el código del formulario.',
        N'Administra los tipos de empresa desde el catálogo, ahora con Comercializadora.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.472' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.472' AND isActive = 1;
