USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.611'
      AND module = N'Cobranza / Caja web'
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
        NULL, NULL, N'5.00.611', N'Cobranza / Caja web', N'IMPROVEMENT',
        N'Operación offline de Cobranza durante hasta ocho horas',
        N'La caja web puede preparar localmente clientes, préstamos, cuotas, catálogos y datos de caja. Con una sesión previamente validada, permite operar Cobranza sin conexión hasta ocho horas y sincroniza los registros locales al recuperar internet.',
        N'Permite continuar la operación de la caja cuando se interrumpe internet y enviar los movimientos pendientes cuando vuelve la conexión.',
        N'Sigue cobrando durante una interrupción de internet: Cobranza guarda los movimientos en la caja y los sincroniza al recuperar conexión, con acceso offline de hasta ocho horas.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'PRODUCTION', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET validationStatus = N'PASSED',
    releaseStatus = N'PRODUCTION',
    updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.611'
  AND module = N'Cobranza / Caja web'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.611'
  AND module = N'Cobranza / Caja web'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
