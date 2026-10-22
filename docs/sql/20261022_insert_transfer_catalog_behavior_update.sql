USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Traspasos según el comportamiento del catálogo'
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
        NULL, NULL, N'5.00.354', N'Almacenes / Entradas y Salidas', 'FIX',
        N'Traspasos según el comportamiento del catálogo',
        N'El backend reconoce y mantiene los traspasos con el valor TRANSFER configurado en el catálogo activo de Entradas de la empresa. El filtro de partidas consulta las existencias del almacén origen y el guardado crea el movimiento pareado para el destino.',
        N'Permite configurar el comportamiento del traspaso por empresa desde el catálogo y mover solo materiales con existencia en el almacén origen.',
        N'Configura TRASPASO en el catálogo y controla el almacén origen y destino en un solo movimiento.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Traspasos según el comportamiento del catálogo'
  AND isActive = 1;
GO
