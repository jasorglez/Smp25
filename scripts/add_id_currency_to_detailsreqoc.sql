-- Agrega columna id_currency a detailsreqoc (moneda del precio del ítem).
-- La moneda se hereda del proveedor (proveedorxtablas.id_currency) al tomar su costo en la COTIZ
-- y viaja hasta la OC. Referencia al catálogo de monedas (catalog WHERE type='CURRENCY').
-- NULL = MXN por default (mismo criterio que proveedorxtablas.id_currency).
-- ⚠️ Correr en la BD warehouses ANTES de desplegar el backend.

USE [warehouses];
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME='detailsreqoc' AND COLUMN_NAME='id_currency')
BEGIN
    ALTER TABLE [dbo].[detailsreqoc] ADD [id_currency] INT NULL;
    PRINT 'detailsreqoc.id_currency agregada.';
END
ELSE
    PRINT 'detailsreqoc.id_currency ya existe, sin cambios.';
GO
