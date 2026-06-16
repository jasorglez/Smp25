-- ROLLBACK: Revertir vw_MaterialsWithCounts a su estado original
-- Ejecutar en BD: warehouses

-- Dropar la vista que creamos
DROP VIEW [dbo].[vw_MaterialsWithCounts];
GO

-- Recrear la vista CON su definición ORIGINAL (sin el campo 'active')
CREATE VIEW [dbo].[vw_MaterialsWithCounts] AS
SELECT
    m.[id],
    m.[insumo],
    m.[articulo],
    m.[id_category],
    m.[vigente],
    m.[merma],
    m.[fecha],
    COALESCE(c.[description], '') AS [categoria],
    m.[id_familia],
    COALESCE(f.[description], '') AS [familia],
    m.[id_subfamilia],
    COALESCE(sf.[description], '') AS [subfamilia],
    m.[picture],
    (SELECT COUNT(*) FROM [dbo].[proveedorxtablas] pxt
     WHERE pxt.[campo1] = m.[id] AND pxt.[active] = 1) AS [provider_count],
    (SELECT COUNT(DISTINCT pxt.[id_tabla]) FROM [dbo].[proveedorxtablas] pxt
     WHERE pxt.[campo1] = m.[id] AND pxt.[active] = 1) AS [costos_count],
    0 AS [params_count],
    0 AS [subfamily_count],
    m.[id_company],
    m.[porAutorizar]
FROM
    [dbo].[materials] m
LEFT JOIN
    [dbo].[catalog] c ON m.[id_category] = c.[id]
LEFT JOIN
    [dbo].[catalog] f ON m.[id_familia] = f.[id]
LEFT JOIN
    [dbo].[catalog] sf ON m.[id_subfamilia] = sf.[id];
GO

-- Verificar que está OK
SELECT TOP 10 id, insumo, articulo FROM [dbo].[vw_MaterialsWithCounts] ORDER BY id DESC
GO
