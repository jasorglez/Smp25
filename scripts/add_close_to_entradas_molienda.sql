-- ============================================================================
-- Agrega la columna `close` (cierre por ENTRADA) a Delison.entradas_molienda
-- Usada por la columna "Cerrar Entrega" del Nivel 4 de Almacén Molienda.
-- Aplica sobre todo a OCs "COMPRA AUTORIZADA SIN LIMITE" (entradas infinitas,
-- cada entrada se cierra de forma independiente y se bloquea su edición).
--
-- BD: warehouses  (server 76 pruebas / equivalente -delison en server 66)
-- Idempotente: solo crea la columna si no existe.
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[Delison].[entradas_molienda]')
      AND name = N'close'
)
BEGIN
    ALTER TABLE [Delison].[entradas_molienda]
        ADD [close] BIT NOT NULL CONSTRAINT DF_entradas_molienda_close DEFAULT (0);

    PRINT 'Columna [close] agregada a Delison.entradas_molienda.';
END
ELSE
BEGIN
    PRINT 'La columna [close] ya existe; no se hizo nada.';
END
GO
