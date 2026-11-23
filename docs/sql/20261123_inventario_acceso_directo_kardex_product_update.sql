USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.613'
      AND module = N'Almacenes / Inventario'
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
        NULL, NULL, N'5.00.613', N'Almacenes / Inventario y Kardex', N'IMPROVEMENT',
        N'Acceso al Kardex desde el inventario',
        N'Se agregó la columna Kardex inmediatamente después de Existencia. Al abrir el historial de un material, la consulta ahora filtra desde el servidor y devuelve solo sus movimientos en los almacenes autorizados, en una sola solicitud.',
        N'Abre el historial desde Inventario y reduce la espera al evitar descargar movimientos y detalles de otros materiales.',
        N'Consulta más rápido el Kardex de cualquier material desde Inventario.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.613'
  AND module = N'Almacenes / Inventario'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
