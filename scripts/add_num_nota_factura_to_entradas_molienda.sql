-- Agrega columna num_nota_factura a Delison.entradas_molienda
-- Corre ANTES de actualizar el backend (v6.14)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'Delison'
      AND TABLE_NAME   = 'entradas_molienda'
      AND COLUMN_NAME  = 'num_nota_factura'
)
BEGIN
    ALTER TABLE [warehouses].[Delison].[entradas_molienda]
    ADD [num_nota_factura] VARCHAR(50) NULL;
    PRINT 'Columna num_nota_factura agregada correctamente.';
END
ELSE
BEGIN
    PRINT 'La columna num_nota_factura ya existe, no se realizo ningun cambio.';
END
