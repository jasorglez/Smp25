-- ============================================================
-- Cambia el tipo de la columna [nivel_monto] de la tabla Users
-- de NVARCHAR(50) a INT.
--
-- Almacena el ID del nivel de autorizacion de monto (FK a
-- warehouses.Delison.autorizacion_monto.id).
--
-- SEGURO: la columna esta vacia (sin datos) al momento de este script.
-- BD: security
-- ============================================================

ALTER TABLE [security].[dbo].[Users]
ALTER COLUMN [nivel_monto] INT NULL;
