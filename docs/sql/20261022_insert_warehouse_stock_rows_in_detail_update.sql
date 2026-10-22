USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

-- The earlier modal catalog was replaced by automatic rows in the existing detail grid.
UPDATE dbo.product_updates
SET isActive = 0,
    updatedAtUtc = @nowUtc
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Almacenes / Entradas'
  AND title = N'Búsqueda y catálogo completo por marca'
  AND isActive = 1;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Existencias por marca directo en el detalle'
      AND version = N'5.00.362'
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
        NULL, NULL, N'5.00.362', N'Almacenes / Entradas', 'FIX',
        N'Existencias por marca directo en el detalle',
        N'En Ajustes de inventario y Traspasos, las combinaciones de material y marca con existencia positiva se cargan automáticamente en el grid de detalles del almacén origen. La cantidad por capturar inicia en cero y al guardar solo se envían las partidas con cantidad mayor que cero. El cálculo agrupa entradas y salidas por material y marca como Inventarios, evitando una consulta individual de stock por cada combinación y mostrando un indicador mientras se cargan los datos.',
        N'Muestra las mismas existencias que Inventarios, reduce consultas repetidas y avisa mientras prepara las partidas para capturar directamente en el detalle.',
        N'Abre un Ajuste o Traspaso, mira cómo se cargan sus existencias y captura las cantidades en el mismo grid.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencias por marca directo en el detalle'
  AND isActive = 1;
GO
