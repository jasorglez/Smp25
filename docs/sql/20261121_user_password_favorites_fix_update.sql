USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.595'
      AND module = N'Usuarios / Favoritos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.595', N'Usuarios / Favoritos', N'FIX',
        N'Protección de contraseña y rutas útiles en favoritos',
        N'La edición de permisos no altera contraseñas existentes y los favoritos omiten rutas contenedoras vacías y presentan nombres de pantalla limpios.',
        N'Evita perder acceso al modificar permisos y permite abrir favoritos claros y útiles.',
        N'Actualiza permisos sin cambiar contraseñas y abre favoritos claros y útiles.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.595'
  AND module = N'Usuarios / Favoritos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
