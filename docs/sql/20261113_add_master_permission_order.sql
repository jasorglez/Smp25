use security ;

/* Agrega el orden configurable de los módulos principales. */
IF COL_LENGTH(N'dbo.masterpermissions', N'order') IS NULL
BEGIN
    ALTER TABLE dbo.masterpermissions
        ADD [order] INT NOT NULL
            CONSTRAINT DF_masterpermissions_order DEFAULT (10000) WITH VALUES;
END;
GO

/* Mantiene el orden visual actual como base para que el cambio sea gradual. */
UPDATE dbo.masterpermissions
SET [order] = CASE identifier
    WHEN 'dashboard' THEN 10
    WHEN 'administration' THEN 20
    WHEN 'cobranzas' THEN 30
    WHEN 'red' THEN 40
    WHEN 'municipio' THEN 50
    WHEN 'indicators' THEN 60
    WHEN 'shopping' THEN 70
    WHEN 'shoppingDelison' THEN 80
    WHEN 'shoppingTD' THEN 90
    WHEN 'warehouses' THEN 100
    WHEN 'warehousesTD' THEN 110
    WHEN 'maintenance' THEN 120
    WHEN 'hr' THEN 130
    WHEN 'sales' THEN 140
    WHEN 'projects' THEN 150
    WHEN 'preciosunitarios' THEN 160
    WHEN 'pmo' THEN 170
    WHEN 'presupuestos' THEN 180
    WHEN 'setup' THEN 190
    ELSE [order]
END;
GO
