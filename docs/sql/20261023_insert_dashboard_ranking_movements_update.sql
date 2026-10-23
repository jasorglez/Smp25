USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Dashboard / Administración'
      AND title = N'Detalle de movimientos desde los rankings'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.376', N'Dashboard / Administración', 'FEATURE',
        N'Detalle de movimientos desde los rankings',
        N'Las filas de Top Clientes y Top Proveedores / Empleados se pueden abrir para consultar sus movimientos del mismo periodo seleccionado, con fecha, documento, descripción, cantidad e importe en un panel lateral.',
        N'Permite revisar el origen de los totales del ranking sin salir del dashboard.',
        N'Abre un cliente o proveedor y consulta sus movimientos y totales directamente desde el dashboard.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Dashboard / Administración'
  AND title = N'Detalle de movimientos desde los rankings'
  AND isActive = 1;
GO
