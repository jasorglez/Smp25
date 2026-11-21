USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.588'
      AND module = N'Acceso / Demo'
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
        NULL, NULL, N'5.00.588', N'Acceso / Demo', N'IMPROVEMENT',
        N'Acceso directo a la empresa demo',
        N'Al abrir /demo, BIAPP inicia sesión con la cuenta de demostración y dirige al usuario a la empresa asignada a esa cuenta.',
        N'Permite explorar la empresa demo sin escribir credenciales ni elegir la empresa manualmente.',
        N'Abre la demo de BIAPP directamente desde www.biapp.com.mx/demo.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.588'
  AND module = N'Acceso / Demo'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
