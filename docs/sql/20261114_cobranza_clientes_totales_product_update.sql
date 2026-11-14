USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.512' AND module = N'Cobranza / Clientes'
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
        NULL, NULL, N'5.00.512', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Totales de prestamos, pagos y pendientes por cliente',
        N'El listado presenta tres columnas fijas con los montos de prestamos, pagos y saldos pendientes por cliente, cada una con un color distinto. Oculta Activo y Total credito; actualiza los importes al cambiar prestamos o abonos.',
        N'Permite conocer el estado de cobranza de cada cliente sin abrir su detalle.',
        N'Revisa de un vistazo prestamos, pagos y pendientes de cada cliente.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.512' AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
