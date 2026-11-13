USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.488' AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.488', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Calendario de cuotas y reporte PDF de pagos',
        N'Consulta las cuotas de cada préstamo en un grid de detalle, ajusta sus fechas y genera desde el maestro un reporte PDF con los pagos y el logo de la empresa.',
        N'Permite adaptar el calendario de cobro y entregar un reporte claro al cliente.',
        N'Ajusta las fechas de pago y genera el reporte PDF con la imagen de tu empresa.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'DRAFT', NULL,
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.488' AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
