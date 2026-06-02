-- Agrega columna fecha_vencimiento a entradas_molienda
-- Permite sobrescribir la fecha de vencimiento de crédito calculada automáticamente
-- (fechaRecepcion + N días) con una fecha ingresada manualmente desde Captura de Gastos.
-- Si NULL → el frontend calcula la fecha en tiempo real. Si tiene valor → se usa esa fecha.

USE warehouses;

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'Delison'
      AND TABLE_NAME  = 'entradas_molienda'
      AND COLUMN_NAME = 'fecha_vencimiento'
)
BEGIN
    ALTER TABLE warehouses.Delison.entradas_molienda
    ADD fecha_vencimiento DATE NULL;

    PRINT 'Columna fecha_vencimiento agregada correctamente.';
END
ELSE
BEGIN
    PRINT 'La columna fecha_vencimiento ya existe. No se hizo ningún cambio.';
END
