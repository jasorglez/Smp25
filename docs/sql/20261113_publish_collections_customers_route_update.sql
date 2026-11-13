USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.476' AND isActive = 1
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
        NULL, NULL, N'5.00.476', N'Cobranza / Clientes', 'FEATURE',
        N'Acceso de clientes para el módulo de Cobranza',
        N'Se agregó el acceso Cobranza al sidebar y la ruta /cobranza/clientes. Reutiliza el componente existente de Clientes y verifica el permiso maestro cobranzas junto con el detalle cliente.',
        N'Permite administrar clientes de cobranza con permisos específicos del módulo.',
        N'Administra los clientes de cobranza desde su propio acceso y permiso.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.476' AND isActive = 1;
