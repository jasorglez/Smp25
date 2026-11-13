USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.470' AND isActive = 1
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
        NULL, NULL, N'5.00.470', N'Almacenes / Materiales', 'FIX',
        N'Aviso al eliminar materiales relacionados',
        N'Antes de eliminar un material se solicita confirmación. Si el servicio rechaza el borrado, se muestra el motivo recibido o se indica que puede tener entradas, requisiciones, órdenes de compra o salidas asociadas. La validación efectiva depende del servicio Warehouse.',
        N'Ayuda a conservar materiales que forman parte de documentos y movimientos, e informa por qué no se pudo eliminar.',
        N'Protege tus movimientos: conoce por qué no se puede eliminar un material relacionado.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.470' AND isActive = 1;
