-- ============================================================================
-- "Liberar para almacén" por ítem de OC
-- BD: warehouses · Tabla: dbo.detailsreqoc
--   liberar_almacen BIT NOT NULL DEFAULT 1 → cuando 1, el almacén del depto que pidió la OC
--   puede leer/recibir ese ítem. Las OC creadas en "Generar OC" se enviarán con 0 (gated hasta
--   marcar el check "Liberar para almacén" en Selección de OC). CR y datos existentes = 1.
-- Idempotente.
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.detailsreqoc') AND name = 'liberar_almacen'
)
BEGIN
    ALTER TABLE dbo.detailsreqoc ADD liberar_almacen BIT NOT NULL CONSTRAINT DF_detailsreqoc_liberar_almacen DEFAULT 1;
    -- Datos existentes quedan liberados (1) por el DEFAULT; no se ocultan OCs ya creadas.
END
GO
