-- ============================================================
-- Agrega columna 'prefijo' a la tabla Materials
-- y hace backfill desde materialxmodulo (donde ya existía)
-- ============================================================
-- CORRER EN: warehouses (servidor pruebas: 76.13.28.145)
-- ANTES de reiniciar el backend
-- ============================================================

USE warehouses;
GO

-- 1. Agregar columna (si no existe)
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'Materials' AND COLUMN_NAME = 'prefijo'
)
BEGIN
  ALTER TABLE dbo.Materials ADD prefijo NVARCHAR(100) NULL;
  PRINT 'Columna prefijo agregada a Materials.';
END
ELSE
BEGIN
  PRINT 'La columna prefijo ya existe en Materials.';
END
GO

-- 2. Backfill: copiar prefijos existentes de materialxmodulo → Materials
--    (usa el primer registro no vacío por material si hay varios)
UPDATE m
SET m.prefijo = src.prefijo
FROM dbo.Materials m
INNER JOIN (
  SELECT id_articulo, MAX(prefijo) AS prefijo
  FROM Delison.materialxmodulo
  WHERE prefijo IS NOT NULL AND LEN(prefijo) > 0
  GROUP BY id_articulo
) src ON src.id_articulo = m.id
WHERE m.prefijo IS NULL OR m.prefijo = '';
PRINT 'Backfill de prefijos completado.';
GO
