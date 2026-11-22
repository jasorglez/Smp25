USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.604'
      AND module = N'Cobranza / Préstamos'
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
        NULL, NULL, N'5.00.604', N'Cobranza / Préstamos', N'FIX',
        N'Confirmación de cambios en la cabecera del préstamo',
        N'La edición de la nota y las fechas de la cabecera consulta el registro después del guardado, confirma los valores y presenta el mensaje devuelto por la API cuando no puede actualizarse.',
        N'Permite conocer si la nota y las fechas quedaron guardadas o por qué se rechazó el cambio.',
        N'Actualiza los datos del préstamo y conoce por qué no se guardó si ocurre un error.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.604'
  AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
