USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.597'
      AND module = N'Cobranza / Telegram'
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
        NULL, NULL, N'5.00.597', N'Cobranza / Telegram', N'IMPROVEMENT',
        N'Domicilio del cliente visible al seleccionarlo en Telegram',
        N'Al seleccionar un cliente encontrado en Cobranza, Telegram muestra la dirección registrada con los componentes disponibles: calle, colonia, ciudad, estado y código postal.',
        N'Ayuda al cobrador a confirmar que encontró al cliente correcto antes de registrar la visita o el pago.',
        N'Confirma el domicilio del cliente desde Telegram antes de registrar la visita.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.597'
  AND module = N'Cobranza / Telegram'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
