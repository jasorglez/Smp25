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
        N'El alta permite capturar el interés fijo mensual y consultar el desglose de las cuotas. El PDF conserva la composición de la nota de venta de referencia: folio, franja azul marino para el cliente, tabla de conceptos, panel gris de totales y sección de pagaré enmarcada. Incluye logos, calendario de pagos y espacio para la firma del deudor, sin sección de aval; se abre en la vista previa habitual para imprimir o compartir.',
        N'Muestra capital e interés de cada mensualidad en una nota de venta familiar para el cliente y deja listo el espacio de aceptación.',
        N'Entrega la nota de venta y el pagaré con el calendario detallado de cada pago.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PENDING', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

/* Keep the announcement aligned with refinements to the same release; do not create duplicates. */
UPDATE dbo.product_updates
SET description = N'El alta permite capturar el interés fijo mensual y consultar el desglose de las cuotas. El PDF conserva la composición de la nota de venta de referencia: folio, franja azul marino para el cliente, tabla de conceptos, panel gris de totales y sección de pagaré enmarcada. Incluye logos, calendario de pagos y espacio para la firma del deudor, sin sección de aval; se abre en la vista previa habitual para imprimir o compartir.',
    userBenefit = N'Muestra capital e interés de cada mensualidad en una nota de venta familiar para el cliente y deja listo el espacio de aceptación.',
    promoText = N'Entrega la nota de venta y el pagaré con el calendario detallado de cada pago.',
    updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
