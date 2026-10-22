USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Búsqueda de materiales para traspasos'
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
        NULL, NULL, N'5.00.355', N'Almacenes / Entradas', 'FIX',
        N'Búsqueda de materiales para traspasos',
        N'Al cambiar el tipo de movimiento con las partidas abiertas, el detalle se vuelve a cargar usando el valueAddition del catálogo. En los traspasos solo aparecen materiales existentes con disponibilidad en el almacén origen y se oculta la opción para agregar un material nuevo.',
        N'Mantiene la búsqueda alineada con el tipo de movimiento seleccionado y evita capturar materiales nuevos en un traspaso.',
        N'En los traspasos, elige solo materiales con existencia en el almacén origen.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Búsqueda de materiales para traspasos'
  AND isActive = 1;
GO
