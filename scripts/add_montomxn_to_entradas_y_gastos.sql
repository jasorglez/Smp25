-- Fase 4: persistir la conversión a MXN del pago (monto convertido + tipo de cambio + moneda + fuente).
-- Se agregan a entradas_molienda (pago de entregas/gastos) y gastos_generales (anticipos).
-- monto_mxn = pago/monto (en moneda original) × tipo_cambio. Para MXN: tipo_cambio=1, monto_mxn=monto.
-- ⚠️ Correr en la BD warehouses ANTES de desplegar el backend.

USE [warehouses];
GO

-- entradas_molienda
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='entradas_molienda' AND COLUMN_NAME='monto_mxn')
    ALTER TABLE Delison.entradas_molienda ADD monto_mxn DECIMAL(18,2) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='entradas_molienda' AND COLUMN_NAME='tipo_cambio')
    ALTER TABLE Delison.entradas_molienda ADD tipo_cambio DECIMAL(18,6) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='entradas_molienda' AND COLUMN_NAME='moneda')
    ALTER TABLE Delison.entradas_molienda ADD moneda VARCHAR(5) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='entradas_molienda' AND COLUMN_NAME='fuente_tc')
    ALTER TABLE Delison.entradas_molienda ADD fuente_tc VARCHAR(15) NULL;
PRINT 'entradas_molienda: columnas monto_mxn/tipo_cambio/moneda/fuente_tc listas.';
GO

-- gastos_generales
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='gastos_generales' AND COLUMN_NAME='monto_mxn')
    ALTER TABLE Delison.gastos_generales ADD monto_mxn DECIMAL(18,2) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='gastos_generales' AND COLUMN_NAME='tipo_cambio')
    ALTER TABLE Delison.gastos_generales ADD tipo_cambio DECIMAL(18,6) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='gastos_generales' AND COLUMN_NAME='moneda')
    ALTER TABLE Delison.gastos_generales ADD moneda VARCHAR(5) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='gastos_generales' AND COLUMN_NAME='fuente_tc')
    ALTER TABLE Delison.gastos_generales ADD fuente_tc VARCHAR(15) NULL;
PRINT 'gastos_generales: columnas monto_mxn/tipo_cambio/moneda/fuente_tc listas.';
GO
