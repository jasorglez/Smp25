USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.608'
      AND module = N'Cobranza / Avisos globales'
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
        NULL, NULL, N'5.00.608', N'Cobranza / Avisos globales', N'FEATURE',
        N'Aviso global de cuotas vencidas',
        N'El aviso de vencimientos aparece en la barra principal al entrar al sistema y permanece visible entre módulos. Se actualiza al recibir un cobro, regresar a la ventana o cada cinco minutos.',
        N'Mantiene los atrasos visibles sin importar qué pantalla esté usando el usuario y permite abrir Clientes de Cobranza desde el aviso.',
        N'Consulta los pagos vencidos desde cualquier módulo y entra a Cobranza con un clic.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.608'
  AND module = N'Cobranza / Avisos globales'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
