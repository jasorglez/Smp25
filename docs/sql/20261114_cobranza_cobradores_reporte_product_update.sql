USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.511' AND module = N'Cobranza / Cobradores'
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
        NULL, NULL, N'5.00.511', N'Cobranza / Cobradores', N'IMPROVEMENT',
        N'Reporte de cobros por vendedor y fechas',
        N'Genera un PDF de cobros agrupados por vendedor para un periodo seleccionado, con logo, detalle de pagos, subtotales y total general. Se puede imprimir, descargar y compartir por Telegram o correo.',
        N'Permite revisar y entregar los cobros de cada vendedor para fechas especificas.',
        N'Consulta y comparte los cobros por vendedor en un reporte con el logo de tu empresa.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.511' AND module = N'Cobranza / Cobradores'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
