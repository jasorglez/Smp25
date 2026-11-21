USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.591'
      AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.591', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Edición de clientes desde el modal',
        N'Al hacer doble clic en los datos de un cliente se abre la ventana con su información y el cobrador asignado para editarla y guardarla.',
        N'Permite cambiar el responsable y corregir datos desde un formulario claro, sin editar varias celdas del listado.',
        N'Abre un cliente con doble clic y actualiza sus datos y cobrador en una sola ventana.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PENDING', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.591'
  AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
