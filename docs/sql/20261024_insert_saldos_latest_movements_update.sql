USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Administración / Palacio Municipal / Saldos'
      AND title = N'Mostrar primero los movimientos recientes en Saldos'
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
        NULL, NULL, N'5.00.378', N'Administración / Palacio Municipal / Saldos', 'IMPROVEMENT',
        N'Mostrar primero los movimientos recientes en Saldos',
        N'El grid de movimientos muestra primero las fechas más recientes y continúa en orden descendente. El cálculo cronológico del saldo acumulado y el orden del PDF se conservan.',
        N'Permite localizar de inmediato los movimientos más nuevos sin alterar los saldos ni el reporte.',
        N'Consulta primero los movimientos recientes de cada cuenta en Saldos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Administración / Palacio Municipal / Saldos'
  AND title = N'Mostrar primero los movimientos recientes en Saldos'
  AND isActive = 1;
GO
