USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.590'
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
        NULL, NULL, N'5.00.590', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Asignación de cobradores a clientes',
        N'Al agregar un cliente se puede seleccionar su cobrador o vendedor; la asignación también se puede cambiar desde el listado.',
        N'Permite saber qué responsable atiende a cada cliente y reasignarlo cuando sea necesario.',
        N'Asigna cada cliente de cobranza a su vendedor y consulta al responsable en el listado.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PENDING', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.590'
  AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
