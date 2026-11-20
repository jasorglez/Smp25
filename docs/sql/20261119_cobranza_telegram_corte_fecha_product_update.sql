USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.562' AND module = N'Cobranza / Corte y Telegram'
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
        NULL, NULL, N'5.00.562', N'Cobranza / Corte y Telegram', N'FIX',
        N'Fecha local en cobros y corte de Cobranza',
        N'Telegram muestra la fecha del cobro antes y después de confirmarlo y guarda esa misma fecha según la hora local. El corte convierte a hora local la fecha UTC del turno antes de llenar el período, para evitar un rango invertido entre Desde y Hasta.',
        N'El usuario confirma qué día se registrará el cobro y puede consultarlo en el corte de ese mismo día.',
        N'Confirma la fecha al registrar en Telegram y encuentra el cobro en el período correcto del corte.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PENDING', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.562' AND module = N'Cobranza / Corte y Telegram'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
