USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Consecutivos independientes por proyecto'
      AND isActive = 1
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
        NULL, NULL, N'5.00.374', N'Almacenes / Entradas y Salidas', 'FIX',
        N'Consecutivos independientes por proyecto',
        N'La consulta de configuración de folios ahora elige de forma determinista la fila activa y la creación reutiliza una configuración existente para evitar duplicados. Se consolidaron los consecutivos de Entradas y Salidas con los folios usados y se completaron prefijos faltantes para proyectos revisados.',
        N'Evita que varios proyectos compartan o pierdan el avance del consecutivo y conserva la continuidad de los folios existentes.',
        N'Cada proyecto conserva sus folios de Entrada y Salida sin repetir números.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Consecutivos independientes por proyecto'
  AND isActive = 1;
GO
