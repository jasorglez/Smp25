USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.602'
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
        NULL, NULL, N'5.00.602', N'Cobranza / Calendario de préstamos', N'FIX',
        N'Guardado de fechas seleccionadas en las cuotas',
        N'El calendario normaliza el valor recibido del editor de fecha antes de validarlo y guardarlo, para conservar el día seleccionado por el usuario.',
        N'Evita que la cuota vuelva a la fecha anterior al cambiar su vencimiento.',
        N'Cambia la fecha programada de una cuota y guarda el día que seleccionaste.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.602'
  AND module = N'Cobranza / Calendario de préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
