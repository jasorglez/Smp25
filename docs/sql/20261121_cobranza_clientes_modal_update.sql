USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.589'
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
        NULL, NULL, N'5.00.589', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Alta de clientes en ventana modal',
        N'El botón Agregar abre una ventana para capturar y guardar un cliente nuevo. El formulario valida nombre, sucursal y los datos opcionales antes del alta.',
        N'Permite registrar clientes sin editar una fila vacía del listado y muestra el registro al terminar.',
        N'Agrega clientes de cobranza desde una ventana con todos sus datos principales.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.589'
  AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
