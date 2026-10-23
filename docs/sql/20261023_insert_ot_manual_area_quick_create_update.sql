USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Proyectos / OT manuales'
      AND title = N'Crear áreas desde el selector de OT manuales'
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
        NULL, NULL, N'5.00.377', N'Proyectos / OT manuales', 'FEATURE',
        N'Crear áreas desde el selector de OT manuales',
        N'En el selector de Área se agregó “Agregar nueva Área”. El usuario puede crearla desde el grid; se guarda en el catálogo de la empresa, se recarga en las opciones y queda seleccionada en la OT activa.',
        N'Permite registrar y usar áreas nuevas sin salir del histórico de OT manuales.',
        N'Agrega un área desde el selector y úsala de inmediato en tu OT.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Proyectos / OT manuales'
  AND title = N'Crear áreas desde el selector de OT manuales'
  AND isActive = 1;
GO
