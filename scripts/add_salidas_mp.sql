-- ============================================================================
-- Salidas / consumo de materia prima POR LOTE
-- BD: warehouses · Schema: Delison · Tabla: salidas_mp
--   Cada fila = consumo de un lote-entrada (datos_externos_molienda) por un proceso.
--   Hoy el único proceso que gasta MP es Molienda (MoliendaMatArticulo, Production API).
--   Es la fuente que DESCUENTA el inventario en vivo y llena "Cantidad Salida" del detalle.
--     · id_dato_externo  INT          → lote-entrada consumido (datos_externos_molienda)
--     · id_material      INT          → material consumido
--     · cantidad         DECIMAL(12,2)→ cantidad gastada de ese lote
--     · fecha            DATE         → fecha del consumo (fecha de la molienda)
--     · usuario          VARCHAR(100) → quién utilizó (nombre, del Usuario de la molienda)
--     · id_origen        INT          → id del consumo origen (MoliendaMatArticulo.id)
--     · tipo_origen      VARCHAR(20)  → 'MOLIENDA' (a futuro otros procesos)
--     · active           BIT          → soft delete
-- Idempotente.
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'Delison' AND t.name = 'salidas_mp'
)
BEGIN
    CREATE TABLE Delison.salidas_mp (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_dato_externo INT          NOT NULL,
        id_material     INT          NOT NULL,
        cantidad        DECIMAL(12,2) NOT NULL DEFAULT 0,
        fecha           DATE         NULL,
        usuario         VARCHAR(100) NULL,
        id_origen       INT          NULL,
        tipo_origen     VARCHAR(20)  NULL,
        active          BIT          NOT NULL DEFAULT 1,
        datemodified    DATETIME     NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_salidas_mp_dato_externo ON Delison.salidas_mp (id_dato_externo);
    CREATE INDEX IX_salidas_mp_origen       ON Delison.salidas_mp (id_origen, tipo_origen);
END
GO
