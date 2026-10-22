USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Proyectos / Reportes diarios'
      AND title = N'Candado directo para autorización de reportes diarios'
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
        NULL, NULL, N'5.00.349', N'Proyectos / Reportes diarios', 'FIX',
        N'Candado directo para autorización de reportes diarios',
        N'El grid conserva sus columnas y desactiva la animación de filas. El candado rojo ejecuta directamente el retiro de autorización; al quedar editable, el estado muestra el candado abierto verde y se informa el resultado.',
        N'Permite distinguir el estado del reporte y retirar su autorización con un clic sin que la fila se mueva.',
        N'Consulta y cambia el estado de autorización de tus reportes diarios desde el grid.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Candado directo para autorización de reportes diarios'
  AND isActive = 1;
GO
