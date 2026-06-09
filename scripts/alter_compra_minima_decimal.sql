-- Permite decimales en "Compra Mínima".
-- Antes era INT en detailsreqoc.compraminima y proveedorxtablas.minima_compra.
-- Se cambia a DECIMAL(16,2) (la UI restringe a 1 decimal, pero la columna soporta más).
-- ⚠️ Correr en la BD warehouses ANTES de desplegar el backend.

USE [warehouses];
GO

-- detailsreqoc.compraminima
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_NAME='detailsreqoc' AND COLUMN_NAME='compraminima' AND DATA_TYPE='int')
BEGIN
    ALTER TABLE [dbo].[detailsreqoc] ALTER COLUMN [compraminima] DECIMAL(16,2) NULL;
    PRINT 'detailsreqoc.compraminima -> DECIMAL(16,2).';
END
ELSE
    PRINT 'detailsreqoc.compraminima no es INT (ya migrada o inexistente), sin cambios.';
GO

-- proveedorxtablas.minima_compra
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_NAME='proveedorxtablas' AND COLUMN_NAME='minima_compra' AND DATA_TYPE='int')
BEGIN
    ALTER TABLE [dbo].[proveedorxtablas] ALTER COLUMN [minima_compra] DECIMAL(16,2) NULL;
    PRINT 'proveedorxtablas.minima_compra -> DECIMAL(16,2).';
END
ELSE
    PRINT 'proveedorxtablas.minima_compra no es INT (ya migrada o inexistente), sin cambios.';
GO
