USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Búsqueda y catálogo completo por marca'
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
        NULL, NULL, N'5.00.361', N'Almacenes / Entradas', 'IMPROVEMENT',
        N'Búsqueda y catálogo completo por marca',
        N'En Traspasos y Ajustes se puede buscar un material con el combo habitual o abrir el catálogo completo en un grid. El grid presenta materiales por marca, existencia disponible y una columna amplia para leer descripciones largas; solo agrega partidas con cantidades mayores que cero.',
        N'Facilita capturar materiales con descripciones extensas y revisar todos los saldos por marca en una sola vista.',
        N'Busca un material o consulta el catálogo completo con su existencia por marca.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Búsqueda y catálogo completo por marca'
  AND isActive = 1;
GO
