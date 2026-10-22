USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas'
      AND title = N'Grids estables al editar documentos de almacén'
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
        NULL, NULL, N'5.00.348', N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas', 'FIX',
        N'Grids estables al editar documentos de almacén',
        N'Los grids conservan sus definiciones de columnas entre ciclos de pantalla. Entradas y Salidas las reconstruyen solo cuando cambia el contexto que controla qué columnas se muestran. El candado rojo ejecuta directamente la acción para retirar autorización y el estado editable muestra un candado abierto verde.',
        N'Evita el parpadeo de columnas y muestra claramente cuándo un documento está autorizado o editable.',
        N'Identifica el estado de autorización y abre el documento con un clic en el candado.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Grids estables al editar documentos de almacén'
  AND isActive = 1;
GO
