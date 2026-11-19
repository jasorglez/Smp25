USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
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
        NULL, NULL, N'5.00.556', N'Cobranza / Préstamos', N'IMPROVEMENT',
        N'Interés mensual y desglose del pagaré',
        N'El alta permite capturar el interés fijo mensual y consultar el desglose de las cuotas. La lista separa cada préstamo; al abrir su detalle se consultan sus pagos y se genera el PDF de ese préstamo. La nota conserva la composición de referencia: folio ligado al préstamo, franja azul marino para el cliente, panel gris de totales, calendario de pagos y sección de pagaré enmarcada con espacio de firma para el deudor, sin aval. La vista previa permite imprimir y compartir; para 10 pagos, el contenido cabe en una página.',
        N'Identifica cada préstamo del cliente y entrega la nota correspondiente con el desglose de capital e interés.',
        N'Abre el préstamo que necesitas y genera su pagaré con cada mensualidad detallada.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PENDING', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

/* Keep the announcement aligned with refinements to the same release; do not create duplicates. */
UPDATE dbo.product_updates
SET description = N'El alta permite capturar el interés fijo mensual y consultar el desglose de las cuotas. La lista separa cada préstamo; al abrir su detalle se consultan sus pagos y se genera el PDF de ese préstamo. La nota conserva la composición de referencia: folio ligado al préstamo, franja azul marino para el cliente, panel gris de totales, calendario de pagos y sección de pagaré enmarcada con espacio de firma para el deudor, sin aval. La vista previa permite imprimir y compartir; para 10 pagos, el contenido cabe en una página.',
    userBenefit = N'Identifica cada préstamo del cliente y entrega la nota correspondiente con el desglose de capital e interés.',
    promoText = N'Abre el préstamo que necesitas y genera su pagaré con cada mensualidad detallada.',
    updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
