-- Agrega columna prefijo al catálogo de Departamentos (security.dbo.Roles).
-- ⚠️ Correr en la base de datos **security** (NO warehouses). Antes del backend de Security.

USE [security];
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME='Roles' AND COLUMN_NAME='prefijo')
BEGIN
    ALTER TABLE [dbo].[Roles] ADD [prefijo] VARCHAR(4) NULL;
    PRINT 'Roles.prefijo agregada.';
END
ELSE
    PRINT 'Roles.prefijo ya existe, sin cambios.';
