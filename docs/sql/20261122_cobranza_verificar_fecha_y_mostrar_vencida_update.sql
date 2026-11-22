USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.603'
      AND module = N'Cobranza / Calendario de préstamos'
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
        NULL, NULL, N'5.00.603', N'Cobranza / Calendario de préstamos', N'FIX',
        N'Estado de cuotas vencidas y verificación de fechas',
        N'El detalle marca como vencidas las cuotas pendientes con fecha anterior a hoy y verifica en la respuesta de la API que cada fecha modificada haya quedado guardada.',
        N'Permite identificar el atraso en el calendario y confirmar el cambio de vencimiento.',
        N'Detecta cuotas vencidas y confirma que la nueva fecha quedó guardada.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.603'
  AND module = N'Cobranza / Calendario de préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
