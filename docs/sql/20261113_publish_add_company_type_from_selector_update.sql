USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.473' AND isActive = 1
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
        NULL, NULL, N'5.00.473', N'SMP / Empresas', 'FEATURE',
        N'Agrega un tipo de empresa desde el selector',
        N'El selector Tipo de empresa incluye Agregar Nuevo. Al elegirlo, solicita un nombre, lo guarda en el catálogo compartido de SMP y lo selecciona en la empresa. Si el tipo ya existe, permite reutilizarlo.',
        N'Permite incorporar tipos para probarlos sin salir del formulario ni modificar código.',
        N'Agrega nuevos tipos de empresa desde el mismo selector.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.473' AND isActive = 1;
