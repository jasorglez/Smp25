-- ============================================================================
-- FASE 1 — Almacén GLOBAL de Materia Prima (inventario_mp)
-- ----------------------------------------------------------------------------
-- Inventario de materia prima por SUCURSAL + DEPARTAMENTO + MATERIAL. Se irá
-- sumando con las entradas LIBERADAS (pagadas en la Hoja de Gastos). Por ahora
-- solo suma (entradas); las salidas (consumo de producción) vendrán después.
--
-- Hoy la única fuente es el flujo de Molienda, cuyo almacén pertenece al
-- departamento "Extracción y Fermentación" → las entradas se acumulan ahí.
--
-- ADITIVO: solo crea una tabla nueva. Nadie la lee/escribe hasta desplegar el
-- backend/frontend correspondiente. Idempotente.
-- BD: warehouses   |   Esquema: Delison
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'inventario_mp'
)
BEGIN
    CREATE TABLE warehouses.Delison.inventario_mp (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        id_company      INT          NOT NULL,            -- empresa
        id_sucursal     INT          NOT NULL,            -- sucursal (de la OC)
        id_departamento INT          NOT NULL,            -- departamento (Molienda → Extracción y Fermentación)
        id_material     INT          NOT NULL,            -- materia prima (materials.id)
        cantidad        DECIMAL(18,2) NOT NULL DEFAULT (0), -- existencia: += al liberar entrada; -= al salir (futuro)
        active          BIT          NOT NULL DEFAULT (1),
        datemodified    DATETIME     NOT NULL DEFAULT (GETDATE())
    );

    -- Un solo renglón por (empresa, sucursal, departamento, material): permite upsert (find-or-create).
    CREATE UNIQUE INDEX UX_inventario_mp_clave
        ON warehouses.Delison.inventario_mp (id_company, id_sucursal, id_departamento, id_material);
END;
GO

-- Verificación (opcional):
-- SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_NAME='inventario_mp' AND TABLE_SCHEMA='Delison' ORDER BY ORDINAL_POSITION;
