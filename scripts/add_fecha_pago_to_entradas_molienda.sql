-- ============================================================================
-- Agrega la columna `fecha_pago` a Delison.entradas_molienda
-- Fecha en que se confirma/genera el pago real desde la Hoja de Gastos.
-- Se muestra (read-only) en el Nivel 4 de Almacén Molienda, después de "Pago".
--
-- BD: warehouses  (server 76 pruebas / equivalente -delison en server 66)
-- Idempotente: solo crea la columna si no existe.
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[Delison].[entradas_molienda]')
      AND name = N'fecha_pago'
)
BEGIN
    ALTER TABLE [Delison].[entradas_molienda]
        ADD [fecha_pago] DATE NULL;

    PRINT 'Columna [fecha_pago] agregada a Delison.entradas_molienda.';
END
ELSE
BEGIN
    PRINT 'La columna [fecha_pago] ya existe; no se hizo nada.';
END
GO
