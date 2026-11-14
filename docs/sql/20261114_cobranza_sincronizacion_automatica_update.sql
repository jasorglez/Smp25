USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.521',
    module = N'Cobranza / Clientes',
    changeType = N'IMPROVEMENT',
    title = N'Sincronización automática de abonos en Cobranza',
    description = N'El detalle del cliente abierto revisa los préstamos y abonos cada 5 segundos; si encuentra cambios, actualiza los saldos y pagos en la web. Al abrir el formulario de abono, precarga el saldo pendiente de la cuota seleccionada y permite modificarlo. La sincronización se pausa mientras se edita el detalle.',
    userBenefit = N'Refleja los abonos hechos desde Telegram sin cerrar al cliente y agiliza la captura del monto a cobrar.',
    promoText = N'Consulta un cliente y ve sus abonos reflejados automáticamente; al cobrar, el monto pendiente ya aparece listo para registrar.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
