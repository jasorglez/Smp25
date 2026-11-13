use security;
/* Complemento: orden configurable de permisos detallados (submódulos). */
IF COL_LENGTH(N'dbo.detailedpermissions', N'order') IS NULL
BEGIN
    ALTER TABLE dbo.detailedpermissions
        ADD [order] INT NOT NULL
            CONSTRAINT DF_detailedpermissions_order DEFAULT (10000) WITH VALUES;
END;
GO

/* Mantiene primero los registros nuevos existentes y deja los demás al final. */
UPDATE dbo.detailedpermissions
SET [order] = 10000
WHERE [order] = 0;
GO
