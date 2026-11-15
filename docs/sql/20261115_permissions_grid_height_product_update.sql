USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.547' AND module = N'Seguridad / Permisos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.547', N'Seguridad / Permisos', N'IMPROVEMENT',
        N'Grids ampliados del catálogo de permisos',
        N'El catálogo principal y los grids de Detalles y SubDetalles ahora tienen más altura para consultar sus registros con menos desplazamiento.',
        N'Facilita comparar permisos y sus niveles relacionados en una misma vista.',
        N'Consulta más permisos y sus detalles en pantalla desde el catálogo de Seguridad.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'DRAFT', NULL,
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.547' AND module = N'Seguridad / Permisos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
