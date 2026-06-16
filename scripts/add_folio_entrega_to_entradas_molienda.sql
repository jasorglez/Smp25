-- ============================================================================
-- Migración: agregar columna folio_entrega a warehouses.Delison.entradas_molienda
-- Folio de entrega: concatenación folio OC + prefijo entrega + N (ej. OC-JIC3-P1-GON1429-E2)
-- Idempotente: solo agrega la columna si no existe.
-- Ejecutar en: pruebas (76.13.28.145) y producción (66.179.240.10)
-- NOTA: la tabla vive en el esquema [Delison], NO en [dbo].
-- ============================================================================
USE warehouses;
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'Delison'
      AND TABLE_NAME = 'entradas_molienda'
      AND COLUMN_NAME = 'folio_entrega'
)
BEGIN
    ALTER TABLE Delison.entradas_molienda ADD folio_entrega NVARCHAR(50) NULL;
    PRINT 'Columna folio_entrega agregada a Delison.entradas_molienda.';
END
ELSE
BEGIN
    PRINT 'La columna folio_entrega ya existe; no se realizaron cambios.';
END
GO
