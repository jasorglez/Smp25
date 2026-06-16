-- ============================================================================
-- Migración: agregar columna prefix_entrega a warehouses.dbo.prefix_setup
-- Tarjeta "Identificador Entregas" (solo prefijo de texto)
-- Idempotente: solo agrega la columna si no existe.
-- Ejecutar en: pruebas (76.13.28.145) y producción (66.179.240.10)
-- ============================================================================
USE warehouses;
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'prefix_setup' AND COLUMN_NAME = 'prefix_entrega'
)
BEGIN
    ALTER TABLE dbo.prefix_setup ADD prefix_entrega NVARCHAR(20) NULL;
    PRINT 'Columna prefix_entrega agregada a prefix_setup.';
END
ELSE
BEGIN
    PRINT 'La columna prefix_entrega ya existe; no se realizaron cambios.';
END
GO
