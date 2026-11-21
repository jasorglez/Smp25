USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.594'
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
        NULL, NULL, N'5.00.594', N'Navegación / Favoritos', N'IMPROVEMENT',
        N'Favoritos personalizados según el uso',
        N'Las tres pantallas internas más visitadas se muestran como favoritos, con el uso guardado por correo en el navegador.',
        N'Permite volver rápidamente a las pantallas más utilizadas por cada persona.',
        N'Tus pantallas más utilizadas quedan a un clic en Favoritos.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.594'
  AND module = N'Navegación / Favoritos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
