USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.592'
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
        NULL, NULL, N'5.00.592', N'Usuarios / Recuperación', N'FIX',
        N'Búsqueda de usuarios borrados por empresa asignada',
        N'La consulta y restauración de cuentas borradas reconoce la empresa asignada mediante sus permisos, aunque la cuenta no tenga id_company directo.',
        N'Permite encontrar y recuperar cuentas borradas asignadas a la empresa seleccionada.',
        N'Encuentra y recupera las cuentas borradas asignadas a tu empresa.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.592'
  AND module = N'Usuarios / Recuperación'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
