-- ============================================================================
-- Agrega la columna `nota_factura` a Delison.entradas_molienda
-- Permite capturar/llenar la Nota o Factura POR ENTRADA desde la Hoja de Gastos
-- (a veces llega vacía desde Almacén Molienda y se completa en Gastos).
-- Consistente con Delison.entregas_oc.nota_factura (varchar(20)).
--
-- BD: warehouses  (server 76 pruebas / equivalente -delison en server 66)
-- Idempotente: solo crea la columna si no existe.
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[Delison].[entradas_molienda]')
      AND name = N'nota_factura'
)
BEGIN
    ALTER TABLE [Delison].[entradas_molienda]
        ADD [nota_factura] VARCHAR(20) NULL;

    PRINT 'Columna [nota_factura] agregada a Delison.entradas_molienda.';
END
ELSE
BEGIN
    PRINT 'La columna [nota_factura] ya existe; no se hizo nada.';
END
GO
