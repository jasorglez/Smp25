USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.474' AND isActive = 1
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
        NULL, NULL, N'5.00.474', N'Seguridad / Sidebar y permisos', 'FEATURE',
        N'Permisos y sidebar se actualizan automáticamente',
        N'La sesión consulta los permisos de la empresa cada 10 segundos y al regresar a la pestaña. Los cambios asignados desde otro equipo actualizan automáticamente las opciones del sidebar sin cerrar sesión ni recargar manualmente.',
        N'Refleja los permisos nuevos o revocados entre equipos con pocos segundos de espera.',
        N'Tus permisos y el sidebar se actualizan automáticamente en todos tus equipos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.474' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.474' AND isActive = 1;
