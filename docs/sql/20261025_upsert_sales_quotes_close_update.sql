USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();
DECLARE @module NVARCHAR(120) = N'Ventas / Cotizaciones';
DECLARE @title NVARCHAR(180) = N'Cierre confiable de partidas y PDF en Cotizaciones';
DECLARE @version NVARCHAR(40) = N'5.00.392';

IF EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = @module
      AND title = @title
      AND version = @version
      AND isActive = 1
)
BEGIN
    UPDATE dbo.product_updates
    SET changeType = 'FIX',
        description = N'La X de partidas y PDF localiza la cotización por su ID, cierra el detalle y restaura la lista maestra.',
        userBenefit = N'Permite salir del detalle y volver al listado de cotizaciones con menos demora.',
        promoText = N'Cierra partidas o PDF y vuelve al listado de cotizaciones con la X.',
        validationStatus = 'PASSED',
        releaseStatus = 'LOCAL',
        publicationStatus = 'PUBLISHED',
        publishedAtUtc = COALESCE(publishedAtUtc, @nowUtc),
        updatedAtUtc = @nowUtc
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = @module
      AND title = @title
      AND version = @version
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
        NULL, NULL, @version, @module, 'FIX', @title,
        N'La X de partidas y PDF localiza la cotización por su ID, cierra el detalle y restaura la lista maestra.',
        N'Permite salir del detalle y volver al listado de cotizaciones con menos demora.',
        N'Cierra partidas o PDF y vuelve al listado de cotizaciones con la X.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = @module AND title = @title AND version = @version
  AND isActive = 1;
GO
