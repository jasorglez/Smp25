USE administration;
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (
  SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
  WHERE version = N'5.00.490' AND module = N'Cobranza / Dashboard'
    AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
  INSERT INTO dbo.product_updates
  (idRoot, idCompany, version, module, changeType, title, description,
   userBenefit, promoText, occurredAtUtc, displayTimeZone,
   validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
   createdBy, createdAtUtc, updatedAtUtc, isActive)
  VALUES
  (NULL, NULL, N'5.00.490', N'Cobranza / Dashboard', N'IMPROVEMENT',
   N'Dashboard de cartera y cobranza',
   N'Consulta cartera otorgada, recuperada, pendiente y vencida; compara cobros programados y recibidos por mes y revisa vencimientos y próximos pagos por cliente.',
   N'Permite priorizar la cobranza y seguir el avance de los préstamos desde una sola pantalla.',
   N'Conoce tu cartera, detecta vencidos y anticipa los próximos cobros.',
   SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
   N'PASSED', N'LOCAL', N'DRAFT', NULL,
   NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1);
END;
COMMIT TRANSACTION;
SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.490' AND module = N'Cobranza / Dashboard'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
