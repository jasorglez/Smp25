USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

UPDATE dbo.product_updates
SET version = N'5.00.356',
    title = N'Existencias visibles en ajustes y traspasos',
    description = N'Ajustes de inventario y Traspasos filtran los materiales usando valueAddition del movimiento y el stock neto del almacén seleccionado arriba del grid. El buscador por código o descripción muestra la existencia disponible y permite elegir solo materiales con existencia positiva.',
    userBenefit = N'Evita capturar materiales sin existencia y permite confirmar el saldo disponible antes de ajustar o traspasar.',
    promoText = N'Consulta el saldo del almacén mientras eliges materiales para ajustes y traspasos.',
    updatedAtUtc = @nowUtc
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Almacenes / Entradas'
  AND title = N'Existencias visibles al elegir materiales para traspasos'
  AND isActive = 1;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Existencias visibles en ajustes y traspasos'
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
        NULL, NULL, N'5.00.356', N'Almacenes / Entradas', 'FIX',
        N'Existencias visibles en ajustes y traspasos',
        N'Ajustes de inventario y Traspasos filtran los materiales usando valueAddition del movimiento y el stock neto del almacén seleccionado arriba del grid. El buscador por código o descripción muestra la existencia disponible y permite elegir solo materiales con existencia positiva.',
        N'Evita capturar materiales sin existencia y permite confirmar el saldo disponible antes de ajustar o traspasar.',
        N'Consulta el saldo del almacén mientras eliges materiales para ajustes y traspasos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencias visibles en ajustes y traspasos'
  AND isActive = 1;
GO
