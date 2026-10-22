USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Trazabilidad de materiales'
      AND title = N'Tipografía compacta en Trazabilidad de materiales'
      AND isActive = 1
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
        NULL, NULL, N'5.00.357', N'Almacenes / Trazabilidad de materiales', 'IMPROVEMENT',
        N'Tipografía compacta en Trazabilidad de materiales',
        N'Se redujo un punto el tamaño de letra del grid.',
        N'Facilita revisar más información del grid en pantalla.',
        N'Consulta más datos de trazabilidad con una vista más compacta.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Tipografía compacta en Trazabilidad de materiales'
  AND isActive = 1;
GO
