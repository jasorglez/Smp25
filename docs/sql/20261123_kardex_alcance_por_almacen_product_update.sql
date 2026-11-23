USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.612'
      AND module = N'Almacenes / Kardex'
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
        NULL, NULL, N'5.00.612', N'Almacenes / Kardex', N'FIX',
        N'Consulta de Kardex con alcance por almacén',
        N'El Kardex consulta las entradas y salidas de los almacenes autorizados sin filtrar por proyecto, de acuerdo con el alcance utilizado por Inventario.',
        N'Muestra en Kardex las entradas y salidas que forman la existencia del almacén aunque no tengan proyecto asignado.',
        N'Consulta en Kardex los movimientos que componen la existencia del almacén, aunque no tengan proyecto asignado.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'PRODUCTION', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET validationStatus = N'PASSED',
    releaseStatus = N'PRODUCTION',
    updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.612'
  AND module = N'Almacenes / Kardex'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.612'
  AND module = N'Almacenes / Kardex'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
