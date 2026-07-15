-- ============================================================
-- Costos y Mapeo de Producto Terminado (BOM) — 2026-06-17
-- Tabla de explosión de materiales (lista de adyacencia / adjacency list)
-- de un producto terminado: padre -> hijo -> nieto... (profundidad variable).
--
-- BD: warehouses  | Schema: Delison
-- Ejecutar en pruebas (76.13.28.145) ANTES de levantar el backend.
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.tables t
    JOIN sys.schemas s ON s.schema_id = t.schema_id
    WHERE s.name = 'Delison' AND t.name = 'producto_terminado_bom'
)
BEGIN
    CREATE TABLE Delison.producto_terminado_bom (
        id               INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_company       INT            NOT NULL,                 -- empresa (idRoot)
        id_producto_root INT            NOT NULL,                 -- vw_finalproduct.id (producto terminado); agrupa todo el arbol
        id_padre         INT            NULL,                     -- FK auto-referenciada a id (NULL = fila raiz = producto terminado)
        id_material      INT            NULL,                     -- material del catalogo (hoja basica o semi-elaborado); NULL en la raiz
        nombre           VARCHAR(150)   NULL,                     -- snapshot display
        es_basico        BIT            NOT NULL DEFAULT 0,       -- 1 = hoja basica (costo ultima compra); 0 = semi-elaborado (costo calculado)
        cantidad         DECIMAL(18,4)  NOT NULL DEFAULT 0,
        unidad           VARCHAR(20)    NULL,                     -- kg, L, pz
        merma_pct        DECIMAL(9,4)   NOT NULL DEFAULT 0,       -- % desperdicio / scrap
        costo_unitario   DECIMAL(18,4)  NOT NULL DEFAULT 0,       -- cache (basico=ultima compra; semi=costo_base Capa 1)
        costo_total      DECIMAL(18,4)  NOT NULL DEFAULT 0,       -- cache = cantidad * costo_unitario * (1+merma_pct/100)
        orden            INT            NOT NULL DEFAULT 0,
        nivel            INT            NOT NULL DEFAULT 0,        -- cache profundidad
        comentarios      VARCHAR(200)   NULL,
        active           BIT            NOT NULL DEFAULT 1,
        datemodified     DATETIME       NOT NULL DEFAULT GETDATE()
    );

    -- Indice para cargar el arbol completo de un producto de una empresa
    CREATE INDEX IX_pt_bom_company_root
        ON Delison.producto_terminado_bom (id_company, id_producto_root, active);

    -- Indice para navegar por padre
    CREATE INDEX IX_pt_bom_padre
        ON Delison.producto_terminado_bom (id_padre);

    PRINT 'Tabla Delison.producto_terminado_bom creada.';
END
ELSE
BEGIN
    PRINT 'Tabla Delison.producto_terminado_bom ya existe. Sin cambios.';
END
GO
