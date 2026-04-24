-- =============================================
-- SCRIPT DE CREACIÓN: TABLA DETAILSCONCEPTS
-- Sistema de Ingresos y Egresos - Detalle de Comprobantes por Concepto
-- =============================================

-- =============================================
-- 1. CREAR TABLA detailsconcepts
-- =============================================

CREATE TABLE [dbo].[detailsconcepts]
(
    [id] INT IDENTITY(1,1) NOT NULL,
    [id_conceptsxincorexp] INT NOT NULL,
    [picture] VARCHAR(250) NULL,
    [pdf] VARCHAR(250) NULL,
    [xml_content] VARCHAR(MAX) NULL,
    [active] BIT NOT NULL DEFAULT 1,
    [created_by] VARCHAR(50) NOT NULL,
    [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
    [modified_by] VARCHAR(50) NULL,
    [modified_at] DATETIME NULL,

    CONSTRAINT PK_detailsconcepts PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT FK_detailsconcepts_conceptsxincorexp
        FOREIGN KEY ([id_conceptsxincorexp])
        REFERENCES [dbo].[conceptsxincorexp]([id])
);

GO

-- =============================================
-- 2. CREAR ÍNDICES
-- =============================================

-- Índice para búsquedas por concepto
CREATE NONCLUSTERED INDEX idx_detailsconcepts_conceptsxincorexp
ON [dbo].[detailsconcepts]([id_conceptsxincorexp] ASC)
WHERE [active] = 1;

-- Índice para búsquedas por estado activo
CREATE NONCLUSTERED INDEX idx_detailsconcepts_active
ON [dbo].[detailsconcepts]([active] ASC)
INCLUDE ([id_conceptsxincorexp], [created_at]);

GO

-- =============================================
-- 3. COMENTARIOS DESCRIPTIVOS (Extended Properties)
-- =============================================

EXEC sys.sp_addextendedproperty
    @name=N'MS_Description',
    @value=N'Tabla de detalle para comprobantes de conceptos de ingresos y egresos',
    @level0type=N'SCHEMA', @level0name=N'dbo',
    @level1type=N'TABLE', @level1name=N'detailsconcepts';

EXEC sys.sp_addextendedproperty
    @name=N'MS_Description',
    @value=N'Identificador único del detalle',
    @level0type=N'SCHEMA', @level0name=N'dbo',
    @level1type=N'TABLE', @level1name=N'detailsconcepts',
    @level2type=N'COLUMN', @level2name=N'id';

EXEC sys.sp_addextendedproperty
    @name=N'MS_Description',
    @value=N'Referencia al concepto de ingreso o egreso',
    @level0type=N'SCHEMA', @level0name=N'dbo',
    @level1type=N'TABLE', @level1name=N'detailsconcepts',
    @level2type=N'COLUMN', @level2name=N'id_conceptsxincorexp';

EXEC sys.sp_addextendedproperty
    @name=N'MS_Description',
    @value=N'Ruta o URL de la imagen del comprobante del concepto',
    @level0type=N'SCHEMA', @level0name=N'dbo',
    @level1type=N'TABLE', @level1name=N'detailsconcepts',
    @level2type=N'COLUMN', @level2name=N'picture';

EXEC sys.sp_addextendedproperty
    @name=N'MS_Description',
    @value=N'Ruta o URL del archivo PDF del comprobante',
    @level0type=N'SCHEMA', @level0name=N'dbo',
    @level1type=N'TABLE', @level1name=N'detailsconcepts',
    @level2type=N'COLUMN', @level2name=N'pdf';

EXEC sys.sp_addextendedproperty
    @name=N'MS_Description',
    @value=N'Contenido XML del comprobante fiscal del concepto',
    @level0type=N'SCHEMA', @level0name=N'dbo',
    @level1type=N'TABLE', @level1name=N'detailsconcepts',
    @level2type=N'COLUMN', @level2name=N'xml_content';

EXEC sys.sp_addextendedproperty
    @name=N'MS_Description',
    @value=N'Indica si el registro está activo (1) o inactivo (0)',
    @level0type=N'SCHEMA', @level0name=N'dbo',
    @level1type=N'TABLE', @level1name=N'detailsconcepts',
    @level2type=N'COLUMN', @level2name=N'active';

GO

-- =============================================
-- 4. QUERY DE VERIFICACIÓN
-- =============================================

-- Verificar que la tabla se creó correctamente
SELECT
    t.name AS [Tabla],
    c.name AS [Columna],
    ty.name AS [Tipo],
    c.max_length AS [Longitud],
    c.is_nullable AS [Acepta NULL]
FROM sys.tables t
INNER JOIN sys.columns c ON t.object_id = c.object_id
INNER JOIN sys.types ty ON c.user_type_id = ty.user_type_id
WHERE t.name = 'detailsconcepts'
ORDER BY c.column_id;

-- Verificar foreign keys
SELECT
    fk.name AS [FK Name],
    OBJECT_NAME(fk.parent_object_id) AS [Tabla Origen],
    OBJECT_NAME(fk.referenced_object_id) AS [Tabla Referenciada]
FROM sys.foreign_keys fk
WHERE fk.parent_object_id = OBJECT_ID('detailsconcepts');

-- Verificar índices
SELECT
    i.name AS [Índice],
    i.type_desc AS [Tipo],
    COL_NAME(ic.object_id, ic.column_id) AS [Columna]
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
WHERE i.object_id = OBJECT_ID('detailsconcepts')
ORDER BY i.name, ic.key_ordinal;

GO

-- =============================================
-- 5. EJEMPLO DE USO
-- =============================================

-- Insertar un detalle de ejemplo
-- INSERT INTO [dbo].[detailsconcepts]
-- (
--     [id_conceptsxincorexp],
--     [picture],
--     [pdf],
--     [xml_content],
--     [active],
--     [created_by]
-- )
-- VALUES
-- (
--     1,  -- ID del registro de conceptsxincorexp
--     '/vouchers/2024/concepto_detalle_001.jpg',
--     '/vouchers/2024/concepto_detalle_001.pdf',
--     '<?xml version="1.0" encoding="UTF-8"?><cfdi:Comprobante>...</cfdi:Comprobante>',
--     1,
--     'admin'
-- );

-- Consultar detalles de un concepto específico
-- SELECT
--     d.id,
--     d.picture,
--     d.created_at,
--     d.created_by,
--     c.Description,
--     c.Quantity,
--     c.Price,
--     c.Total
-- FROM detailsconcepts d
-- INNER JOIN conceptsxincorexp c ON d.id_conceptsxincorexp = c.id
-- WHERE d.id_conceptsxincorexp = 1
--   AND d.active = 1;

-- Consultar todos los detalles de conceptos de un ingreso/egreso
-- SELECT
--     d.id,
--     d.picture,
--     d.xml_content,
--     c.Description AS ConceptoDescripcion,
--     c.Quantity,
--     c.Price,
--     c.Total,
--     i.NumberDocument,
--     i.Total AS TotalIngEgr
-- FROM detailsconcepts d
-- INNER JOIN conceptsxincorexp c ON d.id_conceptsxincorexp = c.id
-- INNER JOIN incomeandexpense i ON c.id_incorexp = i.id
-- WHERE i.id = 1
--   AND d.active = 1
--   AND c.active = 1;

-- =============================================
-- FIN DEL SCRIPT
-- =============================================
