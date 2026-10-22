USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos de movimientos'
      AND title = N'Corrige el guardado de tipos de movimiento'
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
        NULL, NULL, N'5.00.345', N'Almacenes / Catálogos de movimientos', 'FIX',
        N'Corrige el guardado de tipos de movimiento',
        N'El formulario envía solo los campos propios del catálogo y omite identificadores temporales internos del grid al crear registros. Si la API devuelve un mensaje de error, se presenta al usuario cuando está disponible.',
        N'Evita fallos al crear tipos y ayuda a entender los errores devueltos por el servidor.',
        N'Guarda tus tipos de movimiento con un mensaje claro si la API reporta un problema.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Corrige el guardado de tipos de movimiento'
  AND isActive = 1;
GO
