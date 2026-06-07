-- Presentaciones de empaque (multifila por proveedor) + re-vínculo de hijas + flag material.
-- Correr ANTES de actualizar el backend (v6.18). BD pruebas → sin backfill.

----------------------------------------------------------------------
-- 1) Tabla de presentaciones (multifila por par material-proveedor)
----------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'empaque_descripcion'
)
BEGIN
    CREATE TABLE [warehouses].[Delison].[empaque_descripcion] (
        [id]                    INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [id_proveedor_tabla]    INT           NOT NULL,   -- FK -> warehouses.dbo.proveedorxtablas.Id
        [id_descripcion_empaque] INT          NULL,        -- FK -> Delison.descripcion_empaque.id
        [pieza_x_paquete]       INT           NULL,
        [active]                BIT           NOT NULL DEFAULT 1,
        [datemodified]          DATETIME      NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_empaque_descripcion_proveedor
        ON [warehouses].[Delison].[empaque_descripcion] (id_proveedor_tabla);
    PRINT 'Tabla Delison.empaque_descripcion creada.';
END
ELSE
    PRINT 'Delison.empaque_descripcion ya existe, sin cambios.';

----------------------------------------------------------------------
-- 2) Re-vincular hijas: id_proveedor_tabla -> id_empaque (apuntan a la presentación)
--    BD pruebas: se descartan filas existentes (apuntaban al proveedor, no a la presentación).
----------------------------------------------------------------------
-- empaque_medidas
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='empaque_medidas' AND COLUMN_NAME='id_proveedor_tabla')
BEGIN
    DELETE FROM [warehouses].[Delison].[empaque_medidas];   -- huérfanas en pruebas
    EXEC sp_rename 'warehouses.Delison.empaque_medidas.id_proveedor_tabla', 'id_empaque', 'COLUMN';
    PRINT 'empaque_medidas.id_proveedor_tabla renombrada a id_empaque.';
END
ELSE
    PRINT 'empaque_medidas ya usa id_empaque (o no existe), sin cambios.';

-- empaque_peso_volumen
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='empaque_peso_volumen' AND COLUMN_NAME='id_proveedor_tabla')
BEGIN
    DELETE FROM [warehouses].[Delison].[empaque_peso_volumen];
    EXEC sp_rename 'warehouses.Delison.empaque_peso_volumen.id_proveedor_tabla', 'id_empaque', 'COLUMN';
    PRINT 'empaque_peso_volumen.id_proveedor_tabla renombrada a id_empaque.';
END
ELSE
    PRINT 'empaque_peso_volumen ya usa id_empaque (o no existe), sin cambios.';

----------------------------------------------------------------------
-- 3) Flag a nivel material: valida_presentaciones (BIT)
----------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_NAME='materials' AND COLUMN_NAME='valida_presentaciones')
BEGIN
    ALTER TABLE [warehouses].[dbo].[materials]
    ADD [valida_presentaciones] BIT NOT NULL DEFAULT 0;
    PRINT 'materials.valida_presentaciones agregada.';
END
ELSE
    PRINT 'materials.valida_presentaciones ya existe, sin cambios.';
GO

----------------------------------------------------------------------
-- 4) Vista vw_MaterialsWithCounts: agregar el flag al final (def. actual + columna nueva)
----------------------------------------------------------------------
ALTER VIEW [dbo].[vw_MaterialsWithCounts] AS
SELECT
    m.[id],
    m.[insumo],
    m.[articulo],
    m.[id_category],
    CAST(m.[vigente] AS BIT) AS [vigente],
    CAST(m.[merma] AS DECIMAL(18,2)) AS [merma],
    CAST(m.[fecha] AS DATE) AS [fecha],
    COALESCE(c.[description], '') AS [categoria],
    m.[id_familia],
    COALESCE(f.[description], '') AS [familia],
    m.[id_subfamilia],
    COALESCE(sf.[description], '') AS [subfamilia],
    m.[picture],
    COALESCE((
        SELECT COUNT(*)
        FROM [dbo].[proveedorxtablas] pxt
        WHERE pxt.[campo1] = m.[id]
        AND CAST(pxt.[active] AS BIT) = 1
    ), 0) AS [provider_count],
    COALESCE((
        SELECT COUNT(DISTINCT pxt.[idtabla])
        FROM [dbo].[proveedorxtablas] pxt
        WHERE pxt.[campo1] = m.[id]
        AND CAST(pxt.[active] AS BIT) = 1
    ), 0) AS [costos_count],
    COALESCE((
        SELECT COUNT(*)
        FROM [dbo].[tablesxmodules] txm
        WHERE txm.[idmaterial] = m.[id]
        AND CAST(txm.[active] AS BIT) = 1
    ), 0) AS [params_count],
    COALESCE((
        SELECT COUNT(*)
        FROM [dbo].[materials] m2
        WHERE m2.[id_subfamilia] = m.[id_subfamilia]
        AND m2.[id] <> m.[id]
        AND CAST(m2.[active] AS BIT) = 1
    ), 0) AS [subfamily_count],
    m.[id_company],
    CAST(m.[porAutorizar] AS BIT) AS [porAutorizar],
    CAST(m.[active] AS BIT) AS [active],
    -- NUEVO: flag de validación por presentaciones/volumen
    CAST(m.[valida_presentaciones] AS BIT) AS [valida_presentaciones]
FROM
    [dbo].[materials] m
LEFT JOIN
    [dbo].[catalog] c ON m.[id_category] = c.[id]
LEFT JOIN
    [dbo].[catalog] f ON m.[id_familia] = f.[id]
LEFT JOIN
    [dbo].[catalog] sf ON m.[id_subfamilia] = sf.[id]
GO

PRINT 'Vista vw_MaterialsWithCounts actualizada con valida_presentaciones.';
