-- Agrega valida_presentaciones a vw_MaterialsWithCounts (definición REAL + columna nueva al final).
-- materials.valida_presentaciones ya fue creada por add_empaque_descripcion_presentaciones.sql.
GO
ALTER VIEW [dbo].[vw_MaterialsWithCounts] AS
  SELECT
      m.[id],
      m.[insumo],
      m.[description] AS [articulo],
      m.[id_category],
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
      ISNULL((SELECT COUNT(*) FROM [dbo].[tablesxmodules] txm
       WHERE txm.[id] = m.[id] AND txm.[active] = 1), 0) AS [params_count],
      0 AS [subfamily_count],
      m.[id_company],
      m.[porAutorizar],
      m.[active],
      -- NUEVO: flag de validación por presentaciones/volumen
      m.[valida_presentaciones]
  FROM
      [dbo].[materials] m
  LEFT JOIN
      [dbo].[catalog] c ON m.[id_category] = c.[id]
  LEFT JOIN
      [dbo].[catalog] f ON m.[id_familia] = f.[id]
  LEFT JOIN
      [dbo].[catalog] sf ON m.[id_subfamilia] = sf.[id]
GO
PRINT 'Vista vw_MaterialsWithCounts: valida_presentaciones agregada correctamente.';
