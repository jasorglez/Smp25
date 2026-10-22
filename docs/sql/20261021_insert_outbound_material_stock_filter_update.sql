USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Materiales disponibles en la búsqueda de Salidas'
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
        NULL, NULL, N'5.00.351', N'Almacenes / Salidas', 'IMPROVEMENT',
        N'Materiales disponibles en la búsqueda de Salidas',
        N'La búsqueda muestra materiales activos con existencia positiva en el almacén seleccionado y conserva materiales de partidas guardadas para su edición. Antes de guardar, valida el saldo neto disponible por material y marca, suma las partidas repetidas y descuenta lo ya registrado en la misma salida; si no puede consultar existencias, detiene el guardado y avisa.',
        N'Evita seleccionar materiales sin saldo y bloquea salidas que dejarían existencias negativas, incluso si el material aparece en varias partidas.',
        N'En Salidas, elige materiales con existencia y evita capturar cantidades por encima del saldo.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;
ELSE
BEGIN
    UPDATE dbo.product_updates
    SET version = N'5.00.351',
        changeType = 'IMPROVEMENT',
        description = N'La búsqueda muestra materiales activos con existencia positiva en el almacén seleccionado y conserva materiales de partidas guardadas para su edición. Antes de guardar, valida el saldo neto disponible por material y marca, suma las partidas repetidas y descuenta lo ya registrado en la misma salida; si no puede consultar existencias, detiene el guardado y avisa.',
        userBenefit = N'Evita seleccionar materiales sin saldo y bloquea salidas que dejarían existencias negativas, incluso si el material aparece en varias partidas.',
        promoText = N'En Salidas, elige materiales con existencia y evita capturar cantidades por encima del saldo.',
        releaseStatus = 'LOCAL',
        publicationStatus = 'PUBLISHED',
        publishedAtUtc = COALESCE(publishedAtUtc, @nowUtc),
        updatedAtUtc = @nowUtc
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Materiales disponibles en la búsqueda de Salidas'
      AND isActive = 1;
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Materiales disponibles en la búsqueda de Salidas'
  AND isActive = 1;
GO
