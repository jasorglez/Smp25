USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Consecutivo de movimiento por proyecto'
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
        NULL, NULL, N'5.00.372', N'Almacenes / Entradas y Salidas', 'FIX',
        N'Consecutivo de movimiento por proyecto',
        N'Al generar un folio, se consulta primero la configuración del proyecto guardado en la fila; la configuración de sucursal se usa solo cuando la fila no tiene proyecto. La selección de empresa, sucursal y proyecto queda registrada en consola para facilitar el diagnóstico si falta el prefijo.',
        N'Mantiene los consecutivos separados por proyecto aunque el usuario tenga varios proyectos o también tenga una sucursal seleccionada.',
        N'Cada proyecto conserva su propio consecutivo para entradas y salidas.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Consecutivo de movimiento por proyecto'
  AND isActive = 1;
GO
