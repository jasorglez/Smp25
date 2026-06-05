-- ============================================================================
-- IVA por entrega (multi-entrega)
-- ----------------------------------------------------------------------------
-- Permite que cada entrega de una OC lleve su propio IVA, de forma independiente.
-- Hasta ahora el IVA vivía solo en detailsreqoc (compartido por todo el ítem OC),
-- por lo que marcar IVA en una entrega lo aplicaba a todas.
--
-- ADITIVO: solo agrega una columna nueva con default 0. Nadie la lee todavía hasta
-- desplegar el backend/frontend correspondiente. Idempotente.
-- BD: warehouses   |   Tabla: Delison.entregas_oc
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'entregas_oc' AND COLUMN_NAME = 'mas_iva'
)
BEGIN
    ALTER TABLE warehouses.Delison.entregas_oc
        ADD mas_iva BIT NOT NULL CONSTRAINT DF_entregas_oc_mas_iva DEFAULT (0);
END;
GO
