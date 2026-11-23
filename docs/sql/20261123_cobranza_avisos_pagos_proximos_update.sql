USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.609'
      AND module = N'Cobranza / Avisos de pago'
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
        NULL, NULL, N'5.00.609', N'Cobranza / Avisos de pago', N'FEATURE',
        N'Recordatorios de pagos próximos para cobradores y administración',
        N'Administración publica por RabbitMQ las cuotas pendientes programadas para hoy y mañana. Telegram las envía al usuario asignado como cobrador; la web muestra un resumen global en vivo y al iniciar sesión. El registro de envío evita duplicados por cuota y fecha.',
        N'Ayuda al cobrador a organizar sus visitas y permite a la administradora anticipar los cobros pendientes.',
        N'Anticipa las cobranzas del día y del siguiente desde Telegram y desde cualquier pantalla web.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.609'
  AND module = N'Cobranza / Avisos de pago'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
