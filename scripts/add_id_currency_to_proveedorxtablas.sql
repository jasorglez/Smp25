-- Agrega columna id_currency a proveedorxtablas (moneda del precio unitario campo9).
-- Referencia al catálogo de monedas (catalog WHERE type='CURRENCY'). NULL = MXN por default.
-- ⚠️ Correr en la BD warehouses ANTES de desplegar el backend.

USE [warehouses];
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME='proveedorxtablas' AND COLUMN_NAME='id_currency')
BEGIN
    ALTER TABLE [dbo].[proveedorxtablas] ADD [id_currency] INT NULL;
    PRINT 'proveedorxtablas.id_currency agregada.';
END
ELSE
    PRINT 'proveedorxtablas.id_currency ya existe, sin cambios.';
