USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.598'
      AND module = N'Cobranza / Clientes y préstamos'
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
        NULL, NULL, N'5.00.598', N'Cobranza / Clientes y préstamos', N'IMPROVEMENT',
        N'Clientes por cobrador y nuevas frecuencias de préstamo',
        N'Se agregó un reporte PDF que agrupa los clientes por el cobrador asignado. Los préstamos permiten programar pagos diarios, semanales, quincenales o mensuales, capturar el interés total y consultar el porcentaje equivalente sobre el capital. El interés total se distribuye entre las cuotas.',
        N'Permite consultar la cartera de cada cobrador y adaptar el calendario y el interés total del préstamo.',
        N'Consulta los clientes de cada cobrador y crea calendarios flexibles con el interés total del préstamo a la vista.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.598'
  AND module = N'Cobranza / Clientes y préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
