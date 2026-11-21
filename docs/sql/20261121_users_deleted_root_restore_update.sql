USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.591'
      AND module = N'Usuarios / Recuperación'
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
        NULL, NULL, N'5.00.591', N'Usuarios / Recuperación', N'IMPROVEMENT',
        N'Recuperación protegida de usuarios borrados',
        N'Root puede consultar los usuarios borrados y restaurarlos. Security restringe estas operaciones a cuentas root activas y oculta usuarios inactivos a los demás usuarios.',
        N'Permite recuperar cuentas desactivadas y evita que usuarios de empresa consulten cuentas borradas.',
        N'Recupera usuarios desde el acceso root con validación de permisos en el servidor.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.591'
  AND module = N'Usuarios / Recuperación'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
