USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.600'
      AND module = N'Cobranza / Calendario y abonos'
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
        NULL, NULL, N'5.00.600', N'Cobranza / Calendario y abonos', N'IMPROVEMENT',
        N'Abonos web conectados con el calendario de Cobranza',
        N'Los abonos capturados desde la web publican el evento de Cobranza y actualizan el tablero con los saldos actuales de las cuotas programadas, vencidas y próximas. El aviso distingue los abonos capturados en la web de los recibidos desde Telegram.',
        N'Mantiene visible el estado de los vencimientos y refleja el efecto de los abonos web sin recargar manualmente el tablero.',
        N'Consulta vencimientos y próximos pagos; los abonos de la web actualizan el tablero al instante.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.600'
  AND module = N'Cobranza / Calendario y abonos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
