USE administration;
GO

-- Actualiza el anuncio vigente sin crear duplicados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.523',
    module = N'Cobranza / Clientes y tickets',
    changeType = N'IMPROVEMENT',
    title = N'Saldo pendiente listo al registrar abonos',
    description = N'El detalle abierto del cliente sincroniza abonos cada 5 segundos. Al pulsar Abonos, el campo Monto recibido se llena con el saldo pendiente de esa cuota y se puede editar. El ticket usa el visor PDF estándar con opciones para compartir y descargar.',
    userBenefit = N'Refleja los cobros recientes y ahorra capturar manualmente el monto pendiente.',
    promoText = N'Consulta los abonos actualizados y cobra el saldo de la cuota con el importe ya listo en pantalla.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
