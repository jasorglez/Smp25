-- ============================================================
-- Costos Ponderados de Básicos (BOM) — 2026-06-17
-- (1) modo_costo por fila del BOM  (2) ventana configurable por empresa
--
-- BD: warehouses | Schema: Delison
-- Ejecutar en pruebas (76.13.28.145) ANTES de levantar el backend.
-- ============================================================

-- (1) Modo de costo por fila del BOM: con qué base se costea un BÁSICO.
--     PONDERADO (default) | ULTIMA | MAXIMO
IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    JOIN sys.objects o ON o.object_id = c.object_id
    JOIN sys.schemas s ON s.schema_id = o.schema_id
    WHERE s.name = 'Delison' AND o.name = 'producto_terminado_bom' AND c.name = 'modo_costo'
)
BEGIN
    ALTER TABLE Delison.producto_terminado_bom
        ADD modo_costo VARCHAR(10) NOT NULL CONSTRAINT DF_pt_bom_modo_costo DEFAULT 'PONDERADO';
    PRINT 'Columna modo_costo agregada a Delison.producto_terminado_bom.';
END
ELSE
    PRINT 'Columna modo_costo ya existe. Sin cambios.';
GO

-- (2) Configuración de costeo por empresa: ventana móvil (en meses) del promedio ponderado.
IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'Delison' AND t.name = 'costos_config'
)
BEGIN
    CREATE TABLE Delison.costos_config (
        id_company    INT          NOT NULL PRIMARY KEY,
        ventana_meses INT          NOT NULL DEFAULT 12,   -- ventana móvil para el promedio ponderado
        datemodified  DATETIME     NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla Delison.costos_config creada.';
END
ELSE
    PRINT 'Tabla Delison.costos_config ya existe. Sin cambios.';
GO
