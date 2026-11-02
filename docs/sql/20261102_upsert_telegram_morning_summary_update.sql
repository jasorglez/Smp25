USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();
DECLARE @version NVARCHAR(40) = N'5.00.412';
DECLARE @module NVARCHAR(120) = N'Telegram / Resumen matutino';
DECLARE @title NVARCHAR(180) = N'Resumen matutino personalizable en Telegram';

IF EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = @version
      AND module = @module
      AND title = @title
      AND isActive = 1
)
BEGIN
    UPDATE dbo.product_updates
    SET changeType = 'IMPROVEMENT',
        description = N'Cada usuario puede activar o pausar el resumen, elegir si incluye ventas y mesas abiertas, y pedirlo al momento con botones.',
        userBenefit = N'Recibe únicamente la información que necesita y consulta el resumen cuando quiera.',
        promoText = N'Personaliza tu resumen de restaurante en Telegram y consúltalo con un toque.',
        occurredAtUtc = '2026-11-02T15:57:00',
        displayTimeZone = N'America/Indiana/Indianapolis',
        validationStatus = 'PASSED',
        releaseStatus = 'LOCAL',
        publicationStatus = 'DRAFT',
        updatedAtUtc = @nowUtc
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = @version
      AND module = @module
      AND title = @title
      AND isActive = 1;
END
ELSE
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
        NULL, NULL, @version, @module, 'IMPROVEMENT', @title,
        N'Cada usuario puede activar o pausar el resumen, elegir si incluye ventas y mesas abiertas, y pedirlo al momento con botones.',
        N'Recibe únicamente la información que necesita y consulta el resumen cuando quiera.',
        N'Personaliza tu resumen de restaurante en Telegram y consúltalo con un toque.',
        '2026-11-02T15:57:00', N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'DRAFT', NULL,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = @version AND module = @module AND title = @title
  AND isActive = 1;
GO
