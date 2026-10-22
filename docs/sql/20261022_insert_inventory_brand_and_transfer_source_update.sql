USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Inventario y Entradas'
      AND title = N'Inventario por marca y origen de traspaso'
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
        NULL, NULL, N'5.00.360', N'Almacenes / Inventario y Entradas', 'IMPROVEMENT',
        N'Inventario por marca y origen de traspaso',
        N'El inventario presenta renglones separados por marca con entradas, salidas y existencia de cada una. Al consultar un traspaso guardado, el selector toma el saldo del almacén origen. Si el proyecto no tiene OT, se oculta esa columna.',
        N'Permite revisar el saldo real de cada marca y elegir materiales disponibles en el almacén desde el que se hará el traspaso.',
        N'Consulta existencias por marca y traspasa materiales desde el almacén origen.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Inventario por marca y origen de traspaso'
  AND isActive = 1;
GO
