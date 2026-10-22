USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Existencias correctas por almacén y marca en traspasos'
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
        NULL, NULL, N'5.00.358', N'Almacenes / Entradas', 'FIX',
        N'Existencias correctas por almacén y marca en traspasos',
        N'Los materiales para ajustes y traspasos consultan la existencia con el endpoint de stock por almacén. En un traspaso, una entrada al almacén destino ya no se suma como existencia del almacén origen. La existencia por marca se vuelve a consultar al seleccionar la marca.',
        N'Muestra los materiales disponibles en el almacén correcto y evita saldos inflados por traspasos dirigidos a otro almacén.',
        N'Consulta las existencias por almacén y marca antes de capturar un ajuste o traspaso.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencias correctas por almacén y marca en traspasos'
  AND isActive = 1;
GO
