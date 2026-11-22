USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.606'
      AND module = N'Navegación / Favoritos'
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
        NULL, NULL, N'5.00.606', N'Navegación / Favoritos', N'FIX',
        N'Ruta estable para el favorito de Clientes de Cobranza',
        N'El favorito de Clientes de Cobranza utiliza la ruta canónica y reconoce los favoritos guardados anteriormente para evitar duplicados.',
        N'Permite abrir Clientes desde el favorito aunque se hubiera guardado con una ruta dinámica anterior.',
        N'Abre Clientes de Cobranza desde tus favoritos con un solo clic.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.606'
  AND module = N'Navegación / Favoritos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
