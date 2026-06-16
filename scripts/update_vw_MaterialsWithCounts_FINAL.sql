-- Script FINAL - Agregar SOLO el campo 'active' a vw_MaterialsWithCounts
-- Ejecutar en BD: warehouses

ALTER VIEW [dbo].[vw_MaterialsWithCounts] AS
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
    CAST((SELECT COUNT(DISTINCT pxt.[id_tabla]) FROM [dbo].[proveedorxtablas] pxt
     WHERE pxt.[campo1] = m.[id] AND pxt.[active] = 1) AS DECIMAL(18,2)) AS [costos_count],
    CAST(0 AS INT) AS [params_count],
    CAST(0 AS INT) AS [subfamily_count],
    m.[id_company],
    m.[porAutorizar],
    m.[active]
FROM
    [dbo].[materials] m
LEFT JOIN
    [dbo].[catalog] c ON m.[id_category] = c.[id]
LEFT JOIN
    [dbo].[catalog] f ON m.[id_familia] = f.[id]
LEFT JOIN
    [dbo].[catalog] sf ON m.[id_subfamilia] = sf.[id]
GO

SELECT TOP 5 id, insumo, articulo, active FROM [dbo].[vw_MaterialsWithCounts] ORDER BY active DESC
GO
