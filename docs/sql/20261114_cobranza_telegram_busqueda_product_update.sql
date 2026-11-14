USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.514' AND module = N'Cobranza / Telegram'
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
        NULL, NULL, N'5.00.514', N'Cobranza / Telegram', N'IMPROVEMENT',
        N'Busqueda de clientes de Cobranza en Telegram',
        N'El bot muestra Cobranza segun los permisos y permite buscar clientes con prestamo activo por numero, telefono o nombre dentro de la empresa seleccionada. Si el usuario tiene una sola empresa, entra directamente.',
        N'El cobrador identifica al cliente correcto desde Telegram sin recorrer listados de otras empresas.',
        N'Encuentra a tus clientes de Cobranza desde Telegram con su numero, telefono o nombre.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.514' AND module = N'Cobranza / Telegram'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
