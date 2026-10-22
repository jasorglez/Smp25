USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Busca materiales pendientes del vale de Entrada'
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
        NULL, NULL, N'5.00.353', N'Almacenes / Salidas', 'FIX',
        N'Busca materiales pendientes del vale de Entrada',
        N'Al seleccionar un vale de Entrada, la búsqueda de partidas también incluye sus materiales con cantidad pendiente. El sistema actualiza los saldos del vale seleccionado y muestra las piezas restantes para capturarlas en la Salida.',
        N'Permite localizar y retirar los materiales que aún quedan en el vale seleccionado.',
        N'En Salidas, encuentra los materiales pendientes del vale de Entrada que estás procesando.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Busca materiales pendientes del vale de Entrada'
  AND isActive = 1;
GO
