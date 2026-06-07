-- Agrega id_proveedor_sugerido a detailsreqoc: proveedor que el panel de presentaciones
-- sugirió en la requisición (para resaltarlo en el dropdown de la cotización).
-- Correr ANTES del backend (v6.21).

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME='detailsreqoc' AND COLUMN_NAME='id_proveedor_sugerido')
BEGIN
    ALTER TABLE [warehouses].[dbo].[detailsreqoc]
    ADD [id_proveedor_sugerido] INT NULL;
    PRINT 'detailsreqoc.id_proveedor_sugerido agregada.';
END
ELSE
    PRINT 'detailsreqoc.id_proveedor_sugerido ya existe, sin cambios.';
