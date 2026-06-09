-- Fase 4: caché diaria del tipo de cambio a MXN por moneda (Banxico FIX / respaldo / manual).
-- Una fila por (moneda, fecha). ⚠️ Correr en la BD warehouses ANTES de desplegar el backend.

USE [warehouses];
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'Delison')
    EXEC('CREATE SCHEMA Delison');
GO

IF OBJECT_ID('Delison.currency_rates', 'U') IS NULL
BEGIN
    CREATE TABLE Delison.currency_rates (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        moneda      VARCHAR(5)     NOT NULL,   -- ISO: USD, EUR, ...
        fecha       DATE           NOT NULL,
        tasa        DECIMAL(18,6)  NOT NULL,   -- pesos por unidad de la moneda
        fuente      VARCHAR(15)    NOT NULL,   -- BANXICO | RESPALDO | MANUAL
        datecreated DATETIME       NOT NULL DEFAULT GETDATE()
    );
    CREATE UNIQUE INDEX UX_currency_rates_moneda_fecha ON Delison.currency_rates (moneda, fecha);
    PRINT 'Delison.currency_rates creada.';
END
ELSE
    PRINT 'Delison.currency_rates ya existe, sin cambios.';
GO
